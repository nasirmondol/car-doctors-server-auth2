const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
var cookieParser = require('cookie-parser')
const cors = require('cors');
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: [
        'http://localhost:5174', 'http://localhost:5173'
        // 'https://car-gallery-9ef24.web.app',
        // 'https://car-gallery-9ef24.firebaseapp.com'
        // 'https://car-doctor-server-one-neon.vercel.app'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dsmrntz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const logger = (req, res, next) => {
    console.log(req.hostname, req.originalUrl);
    next();
}

// verify token
const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    console.log('vefify token in the middleware', token);
    if (!token) {
        return res.status(401).send({ message: 'not authorized' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        console.log(err);
        if (err) {
            return res.status(401).send({ message: 'forbidden access' })
        }
        console.log('decoded token access', decoded);
        req.user = decoded;
        next();
    })
}


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const servicesCollection = client.db('car_doctors-b8').collection('services');
        const bookingsCollections = client.db('car_doctors-b8').collection('bookings');

        //    Auth related apis
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '2hr' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            }).send({ success: true })

        })

        // clear cookie after logout
        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log(user);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })


        // client side related api
        app.get('/services', async (req, res) => {
            const cursor = servicesCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = {
                projection: { title: 1, price: 1, service_id: 1, img: 1 },
            };
            const result = await servicesCollection.findOne(query, options)
            res.send(result);
        })

        app.post('/bookings', async (req, res) => {
            const bookings = req.body;
            // console.log(bookings)
            const result = await bookingsCollections.insertOne(bookings);
            res.send(result);
        })

        app.get('/bookings', logger, verifyToken, async (req, res) => {
            // console.log('booking cookie', req.cookies?.token);
            let query = {};
            console.log(req.user.email);
            if (req.query.email !== req.user.email) {
                return res.status(401).send({ message: 'not authorized' })
            }

            if (req.query?.email) {
                query = { email: req.query.email }
            }

            const result = await bookingsCollections.find(query).toArray();
            res.send(result);
        })

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingsCollections.deleteOne(query);
            res.send(result);
        })

        app.patch('/bookings/:id', async (req, res) => {
            const bookings = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: bookings.status
                },
            };
            const result = await bookingsCollections.updateOne(filter, updateDoc);
            res.send(result);
            console.log(bookings)
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('car doctors is running')
})
app.listen(port, () => {
    console.log(`car doctor sever is running port ${port}`)
})