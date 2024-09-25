import { createHmac } from 'crypto';
import axios, { all } from 'axios';

var dbClient;

function getHMACFromQuery(apiuri,queryParams,secret){
  const timestamp = Math.floor(Date.now() / 1000);
  var path = "";

  const queryProperties = [];
  for (const queryKey of Object.keys(queryParams)){
    if (queryKey !== "sign" && queryKey !== "access_token"){
      queryProperties.push(`${queryKey}${queryParams[queryKey]}`);
    }
  }

  queryProperties.sort();
  path=secret+apiuri+queryProperties.join("")+secret;


  // this is a fixed secret (same app secret shared amongst other stores) - so it's safe to place here
  const hmac = createHmac('sha256',secret);
  hmac.update(path);
  const digest = hmac.digest().toString('hex'); //'hex');//.toUpperCase();
  return digest;
}
export async function tiktokAuthCallback(req, res, _dbClient) {
    dbClient = _dbClient;
    const timestamp = new Date().getTime();
    const apiPath = "/auth/token/create";
                      


      const db = dbClient.db('openintegrations');
      dbClient = _dbClient;
  

      const redirect_url = `https://auth.tiktok-shops.com/api/v2/token/get?app_key=${req.query.app_key}&app_secret=${process.env.TIKTOK_APP_SECRET}&auth_code=${req.query.code}&grant_type=authorized_code`;
      const response = await axios.get(redirect_url);
      const response_data = response.data.data;

      const tiktokSessionDocument = await db.collection('tiktokSession').findOne(
        {
          APP_NAME: process.env.APP_NAME,
          SHOP_ID: process.env.TIKTOK_SHOP_ID
        }
      );
      if (tiktokSessionDocument ){
        const tiktokSessionDeleteCursor = await db.collection('tiktokSession').updateOne(
          {
            APP_NAME: process.env.APP_NAME,
            SHOP_ID: process.env.TIKTOK_SHOP_ID
          },
          {
            $set: {
              ACCESS_TOKEN: response_data.access_token
            }
          }
          
        ); 
      } else {
        const tiktokSessionCursor = await db.collection('tiktokSession').insertOne(
          {
            APP_NAME: process.env.APP_NAME,
            GRANTED_SCOPES: response_data.granted_scopes.join(","),
            SELLER_NAME: response_data.seller_name,
            SELLER_BASE_REGION: response_data.seller_base_region,
            ACCESS_TOKEN: response_data.access_token,
            SHOP_ID: process.env.TIKTOK_SHOP_ID
          }
        );
      }
      res.send("authorisation successful, please see log");

};

async function getTikTokProducts(req, _dbClient) {
  const apiPath="/api/products/search";
  dbClient = _dbClient;

  const db = dbClient.db('openintegrations');

  // get a all products via GET RESTful API call
  const tiktok_session = await db.collection('tiktokSession').findOne(
    {
      APP_NAME: process.env.APP_NAME,
      SHOP_ID: process.env.TIKTOK_SHOP_ID
    }
  );
  const tiktok_app = await db.collection('tiktokApp').findOne(
    {
      APP_NAME: process.env.APP_NAME
    }
  );

  const allProducts = {products:[]};

  const timestamp = Math.floor(Date.now() / 1000);
  const sign = getHMACFromQuery(apiPath, {
    app_key:tiktok_app.APP_KEY,
    shop_id:tiktok_session.SHOP_ID,
    timestamp:timestamp,
    version:"202212"
  },tiktok_app.APP_SECRET);

  const tiktokProductPostUrlString = `https://open-api.tiktokglobalshop.com${apiPath}?access_token=${tiktok_session.ACCESS_TOKEN}&app_key=${tiktok_app.APP_KEY}&shop_id=${tiktok_session.SHOP_ID}&sign=${sign}&timestamp=${timestamp}&version=202212`;
  const tiktokProductPostHeaders = {
    'Content-Type': 'application/json',
    'x-tts-access-token': `${tiktok_session.ACCESS_TOKEN}`
  };
  const tiktokProductPostData = {
      "page_number":1,"page_size":5
  };

  try{
  const response = await axios.post(tiktokProductPostUrlString, tiktokProductPostData, {headers:tiktokProductPostHeaders});
  const response_data = response.data.data;
  allProducts.products.push(response_data.products);
  }catch(err){
   if (err.response && err.response.data){
    console.log("error posting to tiktok: %o",err.response.data); 
   }else {
    console.log("error posting to tiktok: %o",err); 
   }
  }
  return allProducts;

};

export async function apiTiktokProducts(req, res, _dbClient) {
dbClient = _dbClient;
res.send(await getTikTokProducts(req,_dbClient));
};
