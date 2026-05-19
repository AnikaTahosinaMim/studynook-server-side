const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const dotenv = require("dotenv");
const cors = require("cors");
const { jwtVerify, createRemoteJWKSet } = require("jose-cjs");
dotenv.config();
const app = express();
const port = process.env.PORT || 5000;
app.use(cors());

const JWKS = createRemoteJWKSet(new URL("http://localhost:3000/api/auth/jwks"));
console.log(JWKS);
app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGO_URL;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const longer = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized (No token)" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    console.log("PAYLOAD:", payload);

    req.user = payload;

    next();
  } catch (error) {
    console.error("Token validation failed:", error);

    return res.status(401).json({ message: "Unauthorized (Invalid token)" });
  }
};

async function run() {
  try {
    await client.connect();

    const db = client.db("studyNook");
    const bookingCollection = db.collection("nook");

    app.get("/booking", async (req, res) => {
      const cursor = bookingCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/featured", async (req, res) => {
      const cursor = bookingCollection.find().limit(4);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/booking/:bookingId", longer, async (req, res) => {
      console.log("USER:", req.user);
      try {
        const { bookingId } = req.params;

        console.log("Booking ID:", bookingId);

        if (!ObjectId.isValid(bookingId)) {
          return res.status(400).send({
            error: "Invalid ID",
          });
        }

        const query = {
          _id: new ObjectId(bookingId),
        };

        const result = await bookingCollection.findOne(query);

        if (!result) {
          return res.status(404).send({
            error: "Booking not found",
          });
        }

        res.send(result);
      } catch (error) {
        console.log(error);

        res.status(500).send({
          error: "Server Error",
        });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
