const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin:  '*', 
  credentials: false,
}));
app.use(express.json());

// MongoDB 
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.8n6fjbk.mongodb.net/?appName=cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    await client.connect();
    const db = client.db('cozy-rooms');

    const roomsCollection = db.collection('rooms-collection');
    const bookingCollection = db.collection('BookingData-collection');
    const reviewCollection = db.collection('review-collection');
    const offerCollection = db.collection('specialOffers');

    console.log('MongoDB connected');

  

    //allRooms
    app.get('/allRooms', async (req, res) => {
      const priceRanges = {
  All: null, 
  Cozy: { min: 50, max: 99 },
  Luxury: { min: 100, max: 149 },
  Premium: { min: 150, max: 200 }
};
const category = req.query.category || 'All';
  const range = priceRanges[category];

  let pipeline = [];

  if (range) {
    pipeline.push(
      {
        $addFields: {
          numericPrice: {
            $toDouble: {
              $substr: ["$price", 0, { $subtract: [{ $strLenCP: "$price" }, 1] }] 
            }
          }
        }
      },
      {
        $match: {
          numericPrice: { $gte: range.min, $lte: range.max }
        }
      }
    );
  }
      const rooms = range ? await roomsCollection.aggregate(pipeline).toArray() : await roomsCollection.find({}).toArray();
    res.json(rooms);
    });
    


    app.get('/allRooms/:id', async (req, res) => {
      const room = await roomsCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(room);
    });

     //featuredRooms
     app.get('/topRooms', async (req, res) => {
  const reviewCounts = await reviewCollection.aggregate([
  {
  $group: {
  _id: '$title',
  count: { $sum: 1 }
  }
  },
  {
  $sort: { count: -1 ,_id:1} 
  },
  {
  $limit: 6 
  }
  ]).toArray();
 
  const ascendingRoom = reviewCounts.map(item => item._id);
  const topRooms = await Promise.all(
  ascendingRoom.map(async (title) => {
  return await roomsCollection.findOne({ title: title });
  })
  );
  res.json(topRooms.slice(0,6));
  });

 
     // bookedRooms
    app.post('/bookedRooms/:id', async (req, res) => {
      const roomId = req.params.id;
      const booking = {
        roomId: roomId,
        ...req.body
      };
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // Get bookings 
    app.get('/bookedRooms', async (req, res) => {
      const { email } = req.query;
      const user=req.query.email
      const filterUser=user ? {email: user}:{}
      const totalBookings=await bookingCollection
      .find(filterUser)
      .toArray()
      res.send(totalBookings)

      if (!email) {
        return res.status(400).send({ message: 'Email parameter is required' });
      }

      const bookings = await bookingCollection.aggregate([
        { $match: { email } },
        {
          $lookup: {
            from: 'rooms-collection',
            localField: 'roomId',
            foreignField: '_id',
            as: 'room',
          }
        },
        { $unwind: '$room' },
        {
          $project: {
            _id: 1,
            Booked_For: 1,
            title: '$room.title',
            Image: '$room.Image',
            price: '$room.price',
          }
        }
      ]).toArray();

      res.send(bookings);
    });

   

    //bookChecking
    app.get('/bookedRooms/:id', async (req, res) => {
      const roomId = req.params.id;
      const existingBooking = await bookingCollection.findOne({ roomId: roomId });
      res.send({ isBooked: !!existingBooking });

    });

    // Delete booking 
    app.delete('/bookedRooms/:id', async (req, res) => {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).send({ message: 'Email is required in request body' });
      }

      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(req.params.id),
        email: email
      });
      res.send(result);
    });

    // Update booking date 
    app.patch('/bookedRooms/:id', async (req, res) => {
      const { newDate, email } = req.body;
      
      if (!email) {
        return res.status(400).send({ message: 'Email is required' });
      }

      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(req.params.id), email: email },
        { $set: { Booked_For: newDate } }
      );
      res.send(result);
    });

    // Reviews 
    app.post('/reviews', async (req, res) => {
      const review = {
        userName: req.body.userName,
        roomId: new ObjectId(req.body.roomId),
        title: req.body.title,
        rating: parseInt(req.body.rating),
        description: req.body.description,
        date: new Date(),
      };
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });


    // get review
app.get('/reviews/:title', async (req, res) => {
  const roomTitle = req.params.title;
  const totalReviews = await reviewCollection.countDocuments({ title: req.params.title});
   const reviews = await reviewCollection.find({ title: roomTitle }).toArray();
  res.send({ total: totalReviews,reviews:reviews });
});


    // clientReviews
app.get('/clientReviews', async (req, res) => {
  
    const clientReviews = await reviewCollection.aggregate([
      { $sample: { size: 6 } },  
      { $sort: { date: -1 } }   
    ]).toArray();

    res.send(clientReviews);
});

    // Top Rooms
    app.get('/topRooms', async (req, res) => {
      const reviewCounts = await reviewCollection.aggregate([
        { $group: { _id: '$title', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 6 }
      ]).toArray();

      const ascendingRoom = reviewCounts.map(item => item._id);
      const topRooms = await Promise.all(
        ascendingRoom.map(async (title) => roomsCollection.findOne({ title }))
      );

      res.json(topRooms.slice(0, 6));
    });

    // Special Offers
    app.get('/specialOffers', async (req, res) => {
      const today = new Date().toISOString();
      const offers = await offerCollection.find({
        $or: [
          { validUntil: { $exists: false } }, 
          { validUntil: { $gte: today } }
        ]
      }).toArray();
      res.json(offers);
    });


    // root
    app.get('/', (req, res) => res.send('Cozy Rooms API is alive'));
    app.listen(port, () => console.log(`Server running on port ${port}`));

  } catch (err) {
    console.error(err);
  }
}

run();