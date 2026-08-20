export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "VINSS Backend API",
    version: "0.1.0",
    description:
      "Privacy-safe VINSS backend: ciphertext discovery, encrypted presence, scoped Agent orchestration, and application services.",
  },
  tags: [
    { name: "System" },
    { name: "Discovery" },
    { name: "Presence" },
    { name: "Agent" },
    { name: "Loyalty" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Backend liveness",
        responses: {
          "200": {
            description: "Process is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    network: { type: "string", example: "sepolia" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/discover": {
      post: {
        tags: ["Discovery"],
        summary: "Discover committed encrypted actions",
        description:
          "Returns ciphertext and public Starknet metadata. Channel keys are rejected and decryption is not performed by the backend.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["kind"],
                properties: {
                  kind: {
                    type: "string",
                    enum: ["message", "offer", "escrow"],
                  },
                  fromBlock: {
                    type: "integer",
                    minimum: 0,
                    default: 0,
                  },
                  toBlock: {
                    oneOf: [
                      { type: "integer", minimum: 0 },
                      { type: "string", enum: ["latest"] },
                    ],
                    default: "latest",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Encrypted action records",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/EncryptedAction" },
                },
              },
            },
          },
          "400": { description: "Invalid discovery request" },
          "500": { description: "Discovery failed" },
        },
      },
    },
    "/presence/publish": {
      post: {
        tags: ["Presence"],
        summary: "Publish an encrypted presence envelope",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PresencePublish" },
            },
          },
        },
        responses: {
          "204": { description: "Accepted" },
          "400": { description: "Invalid encrypted presence envelope" },
        },
      },
    },
    "/presence/poll": {
      post: {
        tags: ["Presence"],
        summary: "Poll encrypted presence envelopes",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["channelId"],
                properties: {
                  channelId: {
                    type: "string",
                    pattern: "^[a-f0-9]{64}$",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Encrypted presence events" },
          "400": { description: "Invalid presence channel" },
        },
      },
    },
    "/agent/providers": {
      get: {
        tags: ["Agent"],
        summary: "List Agent providers and skills",
        responses: {
          "200": {
            description: "Configured Agent capabilities",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    defaultProvider: { type: "string" },
                    configuredProviders: {
                      type: "array",
                      items: { type: "string" },
                    },
                    skills: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: ["chat", "offer", "escrow"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/agent": {
      post: {
        tags: ["Agent"],
        summary: "Run a scoped VINSS Agent request",
        description:
          "Context is sanitized server-side before a configured LLM provider receives it. Agent tools cannot execute blockchain transactions.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message", "context", "skill"],
                properties: {
                  message: { type: "string", minLength: 1 },
                  context: { type: "object" },
                  skill: {
                    type: "string",
                    enum: ["chat", "offer", "escrow"],
                  },
                  provider: {
                    type: "string",
                    enum: ["auto", "groq", "openai", "anthropic", "qwen"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Agent result/proposal" },
          "400": { description: "Invalid Agent request" },
          "500": { description: "Agent failed" },
        },
      },
    },
    "/loyalty/config": {
      get: {
        tags: ["Loyalty"],
        summary: "Get loyalty rules",
        responses: {
          "200": { description: "Points and levels" },
        },
      },
    },
    "/loyalty/{subject}": {
      get: {
        tags: ["Loyalty"],
        summary: "Get a loyalty account",
        parameters: [
          {
            in: "path",
            name: "subject",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Loyalty account" },
        },
      },
    },
    "/loyalty/events": {
      post: {
        tags: ["Loyalty"],
        summary: "Award a loyalty event",
        description:
          "Current implementation is in-memory and must not be treated as a durable production reward ledger.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["subject", "action", "eventId"],
                properties: {
                  subject: { type: "string", minLength: 1 },
                  action: {
                    type: "string",
                    enum: [
                      "message_sent",
                      "offer_created",
                      "offer_accepted",
                      "escrow_created",
                      "escrow_funded",
                      "deal_completed",
                      "invite_user",
                      "successful_referral",
                    ],
                  },
                  eventId: { type: "string", minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated loyalty account" },
          "400": { description: "Invalid loyalty event" },
        },
      },
    },
  },
  components: {
    schemas: {
      EncryptedAction: {
        type: "object",
        properties: {
          actionLocator: { type: "string", example: "0x..." },
          payloadCommitment: { type: "string", example: "0x..." },
          senderTag: { type: "string", example: "0x..." },
          recipientTag: { type: "string", example: "0x..." },
          ciphertextChunks: {
            type: "array",
            items: { type: "string" },
          },
          blockNumber: { type: "integer" },
          transactionHash: { type: "string", example: "0x..." },
        },
      },
      PresencePublish: {
        type: "object",
        required: ["channelId", "eventId", "iv", "ciphertext", "ttlMs"],
        properties: {
          channelId: {
            type: "string",
            pattern: "^[a-f0-9]{64}$",
          },
          eventId: {
            type: "string",
            minLength: 8,
            maxLength: 96,
          },
          iv: {
            type: "string",
            maxLength: 128,
          },
          ciphertext: {
            type: "string",
            maxLength: 16384,
          },
          ttlMs: {
            type: "integer",
            minimum: 1000,
            maximum: 86400000,
          },
        },
      },
    },
  },
} as const;
