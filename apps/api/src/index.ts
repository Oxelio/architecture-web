import Fastify from "fastify";

const server = Fastify({
  logger: true,
});

server.get("/", function (_, reply) {
  reply.send({ hello: "world" });
});

server.listen({ port: 80, host: "0.0.0.0" }, function (err) {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
