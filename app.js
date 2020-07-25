var express = require('express');
var app = express();
var port = process.env.PORT || 5000;

app.use("/", express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.sendFile("./public/index.html");
});

app.listen(port,()=>{
    console.log("App started on port: "+port);
});