export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "VINSS Backend API",
    version: "0.2.0",
    description:
      "Privacy-safe VINSS backend with persistent ciphertext indexing, global public activity metadata, encrypted presence, scoped Agent orchestration, and network-aware application services.",
  },
  tags: [
    { name: "System" },
    { name: "Discovery" },
    { name: "Activity" },
    { name: "Presence" },
    { name: "Agent" },
    { name: "Loyalty" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Backend and indexer health",
        responses: {
          "200": {
            description: "Backend is healthy",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthResponse",
                },
              },
            },
          },
          "503": {
            description: "Backend or indexer is degraded",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthResponse",
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
        summary: "Read indexed encrypted actions",
        description:
          "Reads the persistent ciphertext index. It does not scan Starknet on request and never accepts room identifiers, room secrets, decryption keys, viewing keys, or plaintext.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["kind"],
                additionalProperties: false,
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
                      {
                        type: "integer",
                        minimum: 0,
                      },
                      {
                        type: "string",
                        enum: ["latest"],
                      },
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
                  items: {
                    $ref: "#/components/schemas/EncryptedAction",
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid or privacy-unsafe discovery request",
          },
          "500": {
            description: "Indexed discovery failed",
          },
        },
      },
    },
    "/activity": {
      get: {
        tags: ["Activity"],
        summary: "Read global public VINSS activity metadata",
        description:
          "Returns only public transaction/index metadata for the Home Global Activity feed. Ciphertext, routing tags, room identifiers and plaintext are not returned here.",
        parameters: [
          {
            in: "query",
            name: "limit",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 30,
            },
          },
          {
            in: "query",
            name: "kind",
            schema: {
              type: "string",
              enum: [
                "message",
                "offer",
                "escrow",
                "rekber_funded",
                "rekber_released",
                "rekber_refunded",
                "certificate_issued",
              ],
            },
          },
          {
            in: "query",
            name: "cursor",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Global activity page",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["network", "items", "nextCursor"],
                  properties: {
                    network: {
                      type: "string",
                      enum: ["sepolia", "mainnet"],
                    },
                    items: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/GlobalActivityItem",
                      },
                    },
                    nextCursor: {
                      nullable: true,
                      type: "string",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid activity query",
          },
          "500": {
            description: "Activity lookup failed",
          },
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
              schema: {
                $ref: "#/components/schemas/PresencePublish",
              },
            },
          },
        },
        responses: {
          "204": {
            description: "Accepted",
          },
          "400": {
            description: "Invalid encrypted presence envelope",
          },
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
          "200": {
            description: "Encrypted presence events",
          },
          "400": {
            description: "Invalid presence channel",
          },
        },
      },
    },
    "/agent/providers": {
      get: {
        tags: ["Agent"],
        summary: "List Agent providers and skills",
        responses: {
          "200": {
            description: "Configured Agent capabilities and service network",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    network: {
                      type: "string",
                      enum: ["sepolia", "mainnet"],
                    },
                    defaultProvider: {
                      type: "string",
                    },
                    configuredProviders: {
                      type: "array",
                      items: {
                        type: "string",
                      },
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
          "Context is sanitized server-side before a configured LLM provider receives it. Agent tools remain proposal-only and cannot execute blockchain transactions.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message", "context", "skill"],
                properties: {
                  message: {
                    type: "string",
                    minLength: 1,
                  },
                  context: {
                    type: "object",
                  },
                  skill: {
                    type: "string",
                    enum: ["chat", "offer", "escrow"],
                  },
                  provider: {
                    type: "string",
                    enum: [
                      "auto",
                      "groq",
                      "openai",
                      "anthropic",
                      "qwen",
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Agent result or proposal",
          },
          "400": {
            description: "Invalid Agent request",
          },
          "500": {
            description: "Agent failed",
          },
        },
      },
    },
    "/loyalty/config": {
      get: {
        tags: ["Loyalty"],
        summary: "Get network-scoped loyalty rules",
        responses: {
          "200": {
            description: "Points and levels",
          },
        },
      },
    },
    "/loyalty/{subject}": {
      get: {
        tags: ["Loyalty"],
        summary: "Get a network-scoped loyalty account",
        parameters: [
          {
            in: "path",
            name: "subject",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Loyalty account",
          },
        },
      },
    },
    "/loyalty/events": {
      post: {
        tags: ["Loyalty"],
        summary: "Award a network-scoped loyalty event",
        description:
          "Loyalty remains a separate application service and is not part of the discovery indexer.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["subject", "action", "eventId"],
                properties: {
                  subject: {
                    type: "string",
                    minLength: 1,
                  },
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
                  eventId: {
                    type: "string",
                    minLength: 1,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated loyalty account",
          },
          "400": {
            description: "Invalid loyalty event",
          },
        },
      },
    },
  },
  components: {
    schemas: {
      EncryptedAction: {
        type: "object",
        required: [
          "actionLocator",
          "payloadCommitment",
          "ciphertextChunks",
          "blockNumber",
          "transactionHash",
        ],
        properties: {
          actionLocator: {
            type: "string",
            example: "0x...",
          },
          payloadCommitment: {
            type: "string",
            example: "0x...",
          },
          senderTag: {
            type: "string",
            example: "0x...",
          },
          recipientTag: {
            type: "string",
            example: "0x...",
          },
          ciphertextChunks: {
            type: "array",
            items: {
              type: "string",
            },
          },
          blockNumber: {
            type: "integer",
          },
          transactionHash: {
            type: "string",
            example: "0x...",
          },
        },
      },
      GlobalActivityItem: {
        type: "object",
        required: [
          "network",
          "kind",
          "contractAddress",
          "actionLocator",
          "blockNumber",
          "transactionHash",
          "indexedAt",
        ],
        properties: {
          network: {
            type: "string",
            enum: ["sepolia", "mainnet"],
          },
          kind: {
            type: "string",
            enum: [
              "message",
              "offer",
              "escrow",
              "rekber_funded",
              "rekber_released",
              "rekber_refunded",
              "certificate_issued",
            ],
          },
          contractAddress: {
            type: "string",
          },
          actionLocator: {
            type: "string",
          },
          blockNumber: {
            type: "integer",
          },
          transactionHash: {
            type: "string",
          },
          indexedAt: {
            type: "string",
            format: "date-time",
          },
          certificate: {
            type: "object",
            properties: {
              tokenId: { type: "string" },
              recipient: { type: "string" },
              custodyCommitment: { type: "string" },
              role: { type: "integer", enum: [1, 2] },
              settledAt: { type: "integer" },
              issuedAt: { type: "integer" },
            },
          },
        },
      },
      IndexerCheckpoint: {
        type: "object",
        required: [
          "identity",
          "kind",
          "contractAddress",
          "startBlock",
          "nextBlock",
          "status",
          "updatedAt",
        ],
        properties: {
          identity: {
            type: "string",
            example: "sepolia:offer:0x...",
          },
          kind: {
            type: "string",
            enum: ["message", "offer", "escrow"],
          },
          contractAddress: {
            type: "string",
          },
          startBlock: {
            type: "integer",
          },
          nextBlock: {
            type: "integer",
          },
          lastIndexedBlock: {
            nullable: true,
            type: "integer",
          },
          latestObservedBlock: {
            nullable: true,
            type: "integer",
          },
          status: {
            type: "string",
            enum: ["idle", "syncing", "caught_up", "error"],
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      HealthResponse: {
        type: "object",
        required: ["status", "network", "indexer"],
        properties: {
          status: {
            type: "string",
            enum: ["ok", "degraded"],
          },
          network: {
            type: "string",
            enum: ["sepolia", "mainnet"],
          },
          indexer: {
            nullable: true,
            type: "object",
            properties: {
              message: {
                $ref: "#/components/schemas/IndexerCheckpoint",
              },
              offer: {
                $ref: "#/components/schemas/IndexerCheckpoint",
              },
              escrow: {
                $ref: "#/components/schemas/IndexerCheckpoint",
              },
            },
          },
          rekberIndexer: {
            nullable: true,
            $ref: "#/components/schemas/IndexerCheckpoint",
          },
          certificateIndexer: {
            nullable: true,
            $ref: "#/components/schemas/IndexerCheckpoint",
          },
        },
      },
      PresencePublish: {
        type: "object",
        required: [
          "channelId",
          "eventId",
          "iv",
          "ciphertext",
          "ttlMs",
        ],
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
