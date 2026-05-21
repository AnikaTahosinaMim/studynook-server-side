const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const dotenv = require("dotenv");
const cors = require("cors");
dotenv.config();
const app = express();
app.use(express.json());
const { jwtVerify, createRemoteJWKSet } = require("jose-cjs");
const port = process.env.PORT || 5000;
app.use(cors());

const JWKS = createRemoteJWKSet(new URL("http://localhost:3000/api/auth/jwks"));
console.log(JWKS);
app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGO_URL;

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
    const myBookingCollection = db.collection("my-bookings");
    // crud add data
    app.post("/room", async (req, res) => {
      const rooms = await req.body;
      console.log(rooms);
      const result = await bookingCollection.insertOne(rooms);
      res.json(result);
    });
    // add data see in browser
    app.get("/room", async (req, res) => {
      const result = await bookingCollection.find().toArray();
      res.json(result);
    });

    // room page data
   app.get("/booking", async (req, res) => {
  try {
    const { search, amenities, startTime, endTime } = req.query;

    let filter = {};

    if (search) {
      filter.roomName = {
        $regex: search,
        $options: "i",
      };
    }

    if (amenities) {
      filter.amenities = { $in: amenities.split(",") };
    }

    if (startTime && endTime) {
      filter.$or = [
        {
          "booking.startTime": { $gte: startTime },
          "booking.endTime": { $lte: endTime },
        },
      ];
    }

    console.log("FILTER:", filter);

    const result = await bookingCollection.find(filter).toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
});

    // homepage 4 data
    app.get("/featured", async (req, res) => {
      const cursor = bookingCollection.find().limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });
    // delete
    app.delete("/room/:id", async (req, res) => {
      const { id } = req.params;
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    // edit;
    app.patch("/room/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData },
        );

        const updatedRoom = await bookingCollection.findOne({
          _id: new ObjectId(id),
        });

        res.json(updatedRoom);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    // books
    app.post("/my-bookings", async (req, res) => {
      try {
        const bookingData = req.body;
        bookingData.createdAt = new Date();

        const { roomId, bookingDate, startTime, endTime } = bookingData;

        const conflict = await myBookingCollection.findOne({
          roomId,
          bookingDate,
          startTime: { $lte: endTime },
          endTime: { $gte: startTime },
        });

        if (conflict) {
          return res.status(400).json({
            message: "This time slot is already booked for this room",
          });
        }

        const result = await myBookingCollection.insertOne(bookingData);

        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({
          message: "Failed to create booking",
          error: error.message,
        });
      }
    });
    // cencel booking
    app.delete("/my-bookings/:id", async (req, res) => {
      const { id } = req.params;

      const result = await myBookingCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });

    app.get("/my-bookings", async (req, res) => {
      try {
        const result = await myBookingCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();

        res.json(result);
      } catch (error) {
        res.status(500).json({
          message: "Failed to fetch bookings",
          error: error.message,
        });
      }
    });

    app.delete("/my-bookings/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await myBookingCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.json(result);
      } catch (error) {
        res.status(500).json({
          message: "Failed to delete booking",
          error: error.message,
        });
      }
    });

    // JWT
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
