import hooks = require("hooks");

function generate_token() {
  return ("Bearer " + Buffer.from("dummy jwt schema").toString("base64")) + "."
         + (Buffer.from(JSON.stringify({service: "admin", username: "admin"})).toString("base64")) + "."
         + (Buffer.from("dummy signature").toString("base64"));

}

hooks.beforeEach((transaction: any, done: any) => {
  // Generate token
  const auth = generate_token();
  if ("request" in transaction) {
      if (("headers" in transaction.request) &&
          ("Authorization" in transaction.request.headers)) {
        transaction.request.headers.Authorization = auth;
      }
  }
  done();
});
