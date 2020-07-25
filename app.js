var express = require('express');
var app = express();

app.use("/", express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.sendFile("./public/index.html");
});

var server = app.listen(5000);