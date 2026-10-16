import {
  ConditionalCheckFailedException,
  CreateTableCommand,
  DynamoDBClient,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "./config";
import { ORADEA_PARKING, type Point } from "./geo";

// status: parked (în parcare, Oradea) | en_route (în cursă) | arrived (a ajuns la destinație)
export type Status = "parked" | "en_route" | "arrived";

export interface Vehicle {
  plate: string;
  model: string;
  status: Status;
  destination?: string;
  lat: number;
  lng: number;
  destLat?: number;
  destLng?: number;
  createdAt: string;
  // Momentul ultimei poziții: worker-ul calculează distanța din timpul scurs de atunci.
  updatedAt: string;
}

export interface Position {
  plate: string;
  destination: string;
  lat: number;
  lng: number;
  at: string;
}

// Pozițiile GPS expiră singure după o oră (TTL în DynamoDB).
const POSITION_TTL_SECONDS = 3600;

const { vehiclesTable, positionsTable, endpoint } = config.dynamodb;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint }), {
  marshallOptions: { removeUndefinedValues: true },
});

// Un update condiționat care nu se aplică întoarce false, nu aruncă eroare.
async function conditional(operation: Promise<unknown>): Promise<boolean> {
  try {
    await operation;
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}

export async function listVehicles(): Promise<Vehicle[]> {
  const { Items = [] } = await db.send(new ScanCommand({ TableName: vehiclesTable }));
  return (Items as Vehicle[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listVehiclesEnRoute(): Promise<Vehicle[]> {
  const { Items = [] } = await db.send(
    new ScanCommand({
      TableName: vehiclesTable,
      FilterExpression: "#status = :enRoute",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":enRoute": "en_route" },
    }),
  );
  return Items as Vehicle[];
}

// Întoarce false dacă mașina există deja.
export function addVehicle(plate: string, model: string): Promise<boolean> {
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    plate,
    model,
    status: "parked",
    ...ORADEA_PARKING,
    createdAt: now,
    updatedAt: now,
  };
  return conditional(
    db.send(new PutCommand({
      TableName: vehiclesTable,
      Item: vehicle,
      ConditionExpression: "attribute_not_exists(plate)",
    })),
  );
}

// Șterge mașina și istoricul ei GPS. Întoarce false dacă mașina nu exista.
export async function deleteVehicle(plate: string): Promise<boolean> {
  const deleted = await conditional(
    db.send(new DeleteCommand({
      TableName: vehiclesTable,
      Key: { plate },
      ConditionExpression: "attribute_exists(plate)",
    })),
  );
  // Un Query întoarce cel mult 1 MB odată; cu GPS la fiecare secundă, istoricul poate fi mai mare.
  const Items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: positionsTable,
        KeyConditionExpression: "plate = :plate",
        ExpressionAttributeValues: { ":plate": plate },
        ProjectionExpression: "plate, #at",
        ExpressionAttributeNames: { "#at": "at" },
        ExclusiveStartKey,
      }),
    );
    Items.push(...(page.Items ?? []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  // BatchWrite acceptă cel mult 25 de operații odată.
  for (let i = 0; i < Items.length; i += 25) {
    await db.send(
      new BatchWriteCommand({
        RequestItems: {
          [positionsTable]: Items.slice(i, i + 25).map((key) => ({ DeleteRequest: { Key: key } })),
        },
      }),
    );
  }
  return deleted;
}

// Cursa pornește întotdeauna din parcarea din Oradea, doar pentru o mașină aflată în parcare.
export function startTrip(plate: string, city: string, destination: Point): Promise<boolean> {
  return conditional(
    db.send(new UpdateCommand({
      TableName: vehiclesTable,
      Key: { plate },
      UpdateExpression:
        "SET #status = :enRoute, destination = :city, destLat = :destLat, destLng = :destLng, " +
        "lat = :lat, lng = :lng, updatedAt = :now",
      ConditionExpression: "attribute_exists(plate) AND #status = :parked",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":enRoute": "en_route",
        ":parked": "parked",
        ":city": city,
        ":destLat": destination.lat,
        ":destLng": destination.lng,
        ":lat": ORADEA_PARKING.lat,
        ":lng": ORADEA_PARKING.lng,
        ":now": new Date().toISOString(),
      },
    })),
  );
}

export function parkVehicle(plate: string): Promise<boolean> {
  return conditional(
    db.send(new UpdateCommand({
      TableName: vehiclesTable,
      Key: { plate },
      UpdateExpression:
        "SET #status = :parked, lat = :lat, lng = :lng, updatedAt = :now " +
        "REMOVE destination, destLat, destLng",
      ConditionExpression: "attribute_exists(plate)",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":parked": "parked",
        ":lat": ORADEA_PARKING.lat,
        ":lng": ORADEA_PARKING.lng,
        ":now": new Date().toISOString(),
      },
    })),
  );
}

// Condițiile evită două situații: mașina a fost trimisă între timp în parcare, sau alt worker
// a mutat-o deja de la aceeași poziție (updatedAt diferit). În ambele cazuri nu scriem nimic.
export function moveVehicle(
  plate: string,
  to: Point,
  status: Status,
  at: string,
  previousUpdatedAt: string,
): Promise<boolean> {
  return conditional(
    db.send(new UpdateCommand({
      TableName: vehiclesTable,
      Key: { plate },
      UpdateExpression: "SET lat = :lat, lng = :lng, #status = :status, updatedAt = :at",
      ConditionExpression: "#status = :enRoute AND updatedAt = :previous",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":previous": previousUpdatedAt,
        ":lat": to.lat,
        ":lng": to.lng,
        ":status": status,
        ":enRoute": "en_route",
        ":at": at,
      },
    })),
  );
}

export async function addPosition(position: Position): Promise<void> {
  const expiresAt = Math.floor(Date.parse(position.at) / 1000) + POSITION_TTL_SECONDS;
  await db.send(new PutCommand({ TableName: positionsTable, Item: { ...position, expiresAt } }));
}

// Ultimele poziții, din toate mașinile: câte un Query pe mașină (cele mai noi primele), apoi
// le amestecăm. Un Scan pe tot tabelul ar citi tot istoricul GPS la fiecare cerere.
export async function latestPositions(limit: number): Promise<Position[]> {
  const vehicles = await listVehicles();
  const perVehicle = await Promise.all(
    vehicles.map(async ({ plate }) => {
      const { Items = [] } = await db.send(
        new QueryCommand({
          TableName: positionsTable,
          KeyConditionExpression: "plate = :plate",
          ExpressionAttributeValues: { ":plate": plate },
          ScanIndexForward: false,
          Limit: limit,
        }),
      );
      return Items as (Position & { expiresAt: number })[];
    }),
  );
  return perVehicle
    .flat()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map(({ expiresAt: _expiresAt, ...position }) => position);
}

// Doar local (DynamoDB Local): în AWS și LocalStack tabelele le creează template.yaml.
export async function createTablesIfMissing(): Promise<void> {
  const tables = [
    { TableName: vehiclesTable, keys: [{ name: "plate", type: "HASH" as const }] },
    {
      TableName: positionsTable,
      keys: [
        { name: "plate", type: "HASH" as const },
        { name: "at", type: "RANGE" as const },
      ],
    },
  ];
  for (const { TableName, keys } of tables) {
    try {
      await db.send(
        new CreateTableCommand({
          TableName,
          BillingMode: "PAY_PER_REQUEST",
          KeySchema: keys.map((k) => ({ AttributeName: k.name, KeyType: k.type })),
          AttributeDefinitions: keys.map((k) => ({ AttributeName: k.name, AttributeType: "S" })),
        }),
      );
      console.log(`[db] tabel creat: ${TableName}`);
    } catch (err) {
      if (!(err instanceof ResourceInUseException)) throw err;
    }
  }
}
