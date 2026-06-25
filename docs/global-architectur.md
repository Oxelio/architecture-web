```
flowchart LR

subgraph API Layer
  A[Fastify Controller / app.ts]
end

subgraph Application Layer
  B[RegisterUseCase]
end

subgraph Domain Layer
  C[User Entity]
  D[Email VO]
  E[Password VO]
end

subgraph Infrastructure Layer
  F[UserRepository]
  G[Argon2PasswordHasher]
  H[(Database)]
end

A --> B

B --> D
B --> E
B --> F
B --> G

F --> H
C --> F
```
