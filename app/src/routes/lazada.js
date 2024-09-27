import { createHmac } from 'crypto';
import axios, { all } from 'axios';

var dbClient;

function getHMACFromQuery(apiuri,queryParams, secret){
  const time = queryParams.timestamp;
  var path = "";

  const queryProperties = [];
  for (const queryKey of Object.keys(queryParams)){
    if (queryKey !== "sign"){
      queryProperties.push(`${queryKey}${queryParams[queryKey]}`);
    }
  }
  queryProperties.sort();
  path=apiuri+queryProperties.join("");


  // this is a fixed secret (same app secret shared amongst other stores) - so it's safe to place here
  const hmac = createHmac('sha256',secret);
  hmac.update(path);
  const digest = hmac.digest().toString('hex').toUpperCase();
  return digest;
}
export async function lazadaAuthCallback(req, res, _dbClient) {
    const timestamp = new Date().getTime();
    const apiPath = "/auth/token/create";
                      

    const shopURL = req.query.shop;

    dbClient = _dbClient;

    const db = dbClient.db('openintegrations');

    // get a all products via GET RESTful API call
    const lazadaApp = await db.collection('lazadaApp').findOne(
      {
        APP_NAME: process.env.APP_NAME
      }
    );
    
      const token_create_params = {
        code : req.query.code,
        app_key : lazadaApp.LAZADA_APP_KEY,
        sign_method : "sha256",
        timestamp: timestamp
    }

    const HMAC = getHMACFromQuery(apiPath,token_create_params, lazadaApp.LAZADA_APP_SECRET);

    const redirect_url = `https://api.lazada.com.my/rest${apiPath}?code=${token_create_params.code}&app_key=${token_create_params.app_key}&sign_method=${token_create_params.sign_method}&timestamp=${token_create_params.timestamp}&sign=${HMAC}`;
    const response = await axios.get(redirect_url);
    const response_data = response.data;

    if (response_data.country_user_info){

      const lazadaSessionDocument = await db.collection('lazadaSession').findOne(
        {
          APP_NAME: process.env.APP_NAME,
          SELLER_ID: response_data.country_user_info[0].seller_id
        }
      );
      if (lazadaSessionDocument ){
        const tiktokSessionUpdateCursor = await db.collection('lazadaSession').updateOne(
          {
            APP_NAME: process.env.APP_NAME,
            SELLER_ID: response_data.country_user_info[0].seller_id
          },
          {
            $set: {
              ACCESS_TOKEN: response_data.access_token
            }
          }
          
        ); 
      } else {
        const lazadaSessionCursor = await db.collection('lazadaSession').insertOne(
          {
            APP_NAME: lazadaApp.APP_NAME,
            ACCESS_TOKEN: response_data.access_token,
            SELLER_ID: response_data.country_user_info[0].seller_id,
            SELLER_SHORT_CODE: response_data.country_user_info[0].short_code
          }
        );
      }
    }
    
    res.send("authorisation successful, please see log");

};

  async function getLazadaProducts(req, _dbClient) {
    const apiPath="/products/get";
    dbClient = _dbClient;
  
    const db = dbClient.db('openintegrations');
  
    // get a all products via GET RESTful API call
    const lazada_session = await db.collection('lazadaSession').findOne(
      {
        APP_NAME: process.env.APP_NAME,
        SELLER_ID: process.env.LAZADA_SELLER_ID
      }
    );
    const lazada_app = await db.collection('lazadaApp').findOne(
      {
        APP_NAME: process.env.APP_NAME
      }
    );

    const allProducts = {products:[]};
    const timestamp = new Date().getTime();

    const sign = getHMACFromQuery(apiPath, {
      app_key:lazada_app.LAZADA_APP_KEY,
      timestamp:timestamp,
      access_token:lazada_session.ACCESS_TOKEN,
      sign_method:'sha256'
    },lazada_app.LAZADA_APP_SECRET);
  
    const lazadaProductGetUrlString = `https://api.lazada.sg/rest${apiPath}?timestamp=${timestamp}&app_key=${lazada_app.LAZADA_APP_KEY}&sign_method=sha256&sign=${sign}&access_token=${lazada_session.ACCESS_TOKEN}`;
    const lazadaProductGetHeaders = {
      'Content-Type': 'application/json'/*,
      'x-tts-access-token': `${tiktok_session.ACCESS_TOKEN}`*/
    };
    const lazadaProductPostData = {/*
        "page_number":1,"page_size":5
        */
    };
  
    try{
    const response = await axios.get(lazadaProductGetUrlString, {headers:lazadaProductGetHeaders});
    const response_data = response.data.data;

    allProducts.products.push(response_data.products);
    }catch(err){
     if (err.response && err.response.data){
      console.log("error posting to lazada: %o",err.response.data); 
     }else {
      console.log("error posting to lazada: %o",err); 
     }
    }
    

    return allProducts;
  };
  
  export async function apiLazadaProducts(req, res, _dbClient) {
  dbClient = _dbClient;
  res.send(await getLazadaProducts(req,_dbClient));
  };
  export async function apiLazadaIndexedProducts(req, res, _dbClient) {
    dbClient = _dbClient;
    const shopURL = req.query.shop;
//    console.log("headers: %o",req.headers);

    //  const client = new MongoClient(process.env.MONGO_CLIENT_URL);
      const products = [];
      try{
    //    await client.connect();
    
        const db = dbClient.db('openintegrations');
    
        var prodQuery = {}
        if(shopURL){
          prodQuery = {shopURL:shopURL};
        }
       
        const productsCursor = await db.collection('lazadaProducts').find(prodQuery);
        for await (const product of productsCursor){
            products.push(product);
        }
      } catch (err) {
        console.log("failed to collect all products from mongodb! err: %o",err);
      }
    //  res.setHeader('content-type', 'Application/Liquid');
    //  res.set('content-type','Application/Liquid');

      res.json({products});
    
};


  export async function apiLazadaProductsIndex(req, res, _dbClient) {
    console.log("about to index lazada products....");
    dbClient = _dbClient;
    const shopURL = req.query.shop;
    // get a all products via GET RESTful API call
  
    try{
  
      const productsResults = await getLazadaProducts(req, _dbClient);
  
      const finalProducts = [];
      if (productsResults.products){
      
        const db = dbClient.db('openintegrations');
  
        db.collection('lazadaProducts').deleteMany({shopURL: shopURL});
  
        //productsResults.body.products.
        productsResults.products[0].forEach(product => { 

          //now write the same product back to mogodb
          try{
            Object.assign(product, {shopURL: shopURL});
            const productsCursor = db.collection('lazadaProducts').insertOne(product);
//            .catch((err) => {
//              res.send({mongoerror: err});
//            });
          }catch(err){
            console.log("error posting to mongodb: %o",err);
          }
          finalProducts.push(product[0]);
      
        });
      }
      res.send(finalProducts);
    } catch(err) {
      console.log(`error  in callingthe shopify client api: ${err.message}`);
      res.send({failed:true, error: err.message});
    }
  }

  