// Specificația OpenAPI 3 a API-ului FleetManager, afișată cu Swagger UI pe /docs.
// Când adăugați sau modificați o rută în server.ts, actualizați și acest fișier.

const plateParam = {
  name: "plate",
  in: "path",
  required: true,
  description: "Numărul de înmatriculare",
  schema: { type: "string", example: "BH-01-FLT" },
};

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "FleetManager API",
    version: "1.4.0",
    description:
      "API-ul aplicației de flotă: vehicule, curse și poziții GPS. " +
      "Mașinile pornesc din parcarea din Oradea; worker-ul le mută spre destinație cu 90 km/h.",
  },
  servers: [{ url: "http://localhost:3000" }, { url: "/" }],
  tags: [
    { name: "Sistem" },
    { name: "Vehicule" },
    { name: "Curse" },
    { name: "GPS" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Sistem"],
        summary: "Verificare de sănătate (folosită de HEALTHCHECK)",
        responses: {
          200: {
            description: "API-ul răspunde",
            content: {
              "application/json": {
                schema: { type: "object", properties: { status: { type: "string", example: "ok" } } },
              },
            },
          },
        },
      },
    },
    "/api/cities": {
      get: {
        tags: ["Curse"],
        summary: "Reședințele de județ disponibile ca destinație",
        responses: {
          200: {
            description: "Lista orașelor",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "string" }, example: ["Arad", "Cluj-Napoca"] },
              },
            },
          },
        },
      },
    },
    "/api/vehicles": {
      get: {
        tags: ["Vehicule"],
        summary: "Lista vehiculelor, cu starea și poziția curentă",
        responses: {
          200: {
            description: "Vehiculele, în ordinea adăugării",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Vehicle" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Vehicule"],
        summary: "Adaugă o mașină în parcarea din Oradea",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/NewVehicle" } } },
        },
        responses: {
          201: {
            description: "Mașina a fost adăugată",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    plate: { type: "string", example: "BH-01-FLT" },
                    model: { type: "string", example: "Dacia Logan" },
                    status: { type: "string", example: "parked" },
                  },
                },
              },
            },
          },
          400: errorResponse("Număr de înmatriculare lipsă sau prea lung"),
          409: errorResponse("Există deja o mașină cu acest număr"),
        },
      },
    },
    "/api/vehicles/{plate}": {
      delete: {
        tags: ["Vehicule"],
        summary: "Șterge mașina și istoricul ei GPS",
        parameters: [plateParam],
        responses: {
          204: { description: "Mașina a fost ștearsă" },
          404: { description: "Mașina nu există" },
        },
      },
    },
    "/api/vehicles/{plate}/trip": {
      post: {
        tags: ["Curse"],
        summary: "Trimite mașina în cursă, din parcarea din Oradea",
        description: "Doar pentru mașini aflate în parcare. Worker-ul începe să trimită poziții GPS.",
        parameters: [plateParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Trip" } } },
        },
        responses: {
          200: {
            description: "Cursa a pornit",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    plate: { type: "string", example: "BH-01-FLT" },
                    status: { type: "string", example: "en_route" },
                    destination: { type: "string", example: "Cluj-Napoca" },
                  },
                },
              },
            },
          },
          400: errorResponse("Orașul nu este o reședință de județ din listă"),
          409: errorResponse("Mașina nu există sau nu este în parcare"),
        },
      },
    },
    "/api/vehicles/{plate}/park": {
      post: {
        tags: ["Curse"],
        summary: "Trimite mașina în parcarea din Oradea",
        description: "Oprește cursa; mașina nu mai trimite poziții GPS.",
        parameters: [plateParam],
        responses: {
          200: {
            description: "Mașina este în parcare",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    plate: { type: "string", example: "BH-01-FLT" },
                    status: { type: "string", example: "parked" },
                  },
                },
              },
            },
          },
          404: errorResponse("Mașina nu există"),
        },
      },
    },
    "/api/positions": {
      get: {
        tags: ["GPS"],
        summary: "Ultimele 10 poziții GPS trimise de worker (din Redis)",
        responses: {
          200: {
            description: "Pozițiile, cea mai recentă prima",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Position" } },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Vehicle: {
        type: "object",
        properties: {
          plate: { type: "string", example: "BH-01-FLT" },
          model: { type: "string", example: "Dacia Logan" },
          status: {
            type: "string",
            enum: ["parked", "en_route", "arrived"],
            description: "parked = în parcare, en_route = în cursă, arrived = a ajuns la destinație",
          },
          destination: { type: "string", nullable: true, example: "Cluj-Napoca" },
          lat: { type: "number", example: 47.0465 },
          lng: { type: "number", example: 21.9189 },
        },
      },
      NewVehicle: {
        type: "object",
        required: ["plate"],
        properties: {
          plate: { type: "string", maxLength: 20, example: "BH-01-FLT" },
          model: { type: "string", default: "Dacia Logan", example: "Ford Transit" },
        },
      },
      Trip: {
        type: "object",
        required: ["city"],
        properties: {
          city: { type: "string", description: "O valoare din GET /api/cities", example: "Cluj-Napoca" },
        },
      },
      Position: {
        type: "object",
        properties: {
          plate: { type: "string", example: "BH-01-FLT" },
          destination: { type: "string", example: "Cluj-Napoca" },
          lat: { type: "number", example: 46.96 },
          lng: { type: "number", example: 22.06 },
          at: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string", example: "Mașina nu există." } },
      },
    },
  },
};
