const express=require('express')
const cors=require('cors')
require('dotenv').config()
const app =express()
const port=process.env.PORT ||3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors())
app.use(express.json());

app.get('/',(req,res)=>{
    res.send('cozy-rooms are roaming')
});

app.listen(port,()=>{
        console.log(`book cozy rooms ${port}`);
        
    })

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.8n6fjbk.mongodb.net/?retryWrites=true&w=majority&appName=cluster0`;


// featured rooms
app.get('/topRooms',async(req,res)=>{
    const roomsCollection = client.db('cozy-rooms').collection('rooms-collection');
    const topRooms=await roomsCollection
    .find({})
      .limit(6)
      .toArray();
    res.json(topRooms);  
})

// allRooms
app.get('/allRooms',async (req,res)=>{
  const roomsCollection=client.db('cozy-rooms').collection('rooms-collection')
  const allRooms=await roomsCollection
  .find({})
  .toArray()
  res.json(allRooms)
  console.log(allRooms);
  
})


    const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);