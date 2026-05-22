import Fastify from "fastify";

const server = Fastify({
  logger: true,
});

server.get("/", function (_, reply) {
  reply.send({ hello: "world" });
});

server.listen({ port: 8090 }, function (err) {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
