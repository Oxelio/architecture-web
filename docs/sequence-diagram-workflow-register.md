```
sequenceDiagram
participant API as Fastify Controller
participant UC as RegisterUseCase
participant Repo as UserRepository
participant Hash as Argon2PasswordHasher
participant DB as Database

API->>UC: execute({email, password})

UC->>UC: Email.of()
UC->>UC: PasswordPlain.create()

UC->>Repo: findByEmail(email)
Repo->>DB: SELECT user
DB-->>Repo: user | null

alt user exists
  UC-->>API: Result.failure(USER_ALREADY_EXISTS)
else user not found
  UC->>Hash: hash(password)
  Hash-->>UC: hashedPassword

  UC->>Repo: save(User)
  Repo->>DB: INSERT user

  UC-->>API: Result.ok(userId)
end
```
