import {Db, MongoClient} from 'mongodb';
import axios, { all } from 'axios';
import BigCommerce from 'node-bigcommerce';

export async function bigcommerceAuth(req, res) { //}, _dbClient) {
    const dbClient = new MongoClient(process.env.MONGO_CLIENT_URL);
    const db = dbClient.db('openintegrations');

    console.log("bigcommerceAuth: req query: %o, req body: %o", req.query, req.body);

    const account_uuid = req.query.account_uuid;
    const code = req.query.code;
    const context = req.query.context;
    const scope = req.query.scope;
    const response_data = {}

    const oauth2_token_url = `https://login.bigcommerce.com/oauth2/token`;
    const oauth2_headers = {
      'Content-Type': 'application/json',
      'accept': 'application/json'
    };
    const app_document = await db.collection("bigcommerceApp").findOne({APP_NAME: process.env.APP_NAME});
    if (app_document) {
        const oauth2_post_data = {
            client_id: app_document.API_KEY,
            client_secret: app_document.API_SECRET, 
            code: code,
            context: context,
            scope: scope,
            grant_type: "authorization_code",
            redirect_uri: `https://${app_document.HOSTNAME}/bigcommerce/auth`
        };
        console.log("oauth2_post_data: %o", oauth2_post_data);

        try{
            const response = await axios.post(oauth2_token_url, oauth2_post_data, {headers:oauth2_headers});
            response_data.data = response.data;
            response_data.data.APP_NAME=process.env.APP_NAME;

            db.collection("bigcommerceSession").insertOne(response_data.data);
        }catch(error){
        console.log("error: %o", error.response.data);
        }
    }

    const shopURL = req.query.shop;
    res.render('index_bc', { 
      title: 'Open Integrations BigCommerce App', 
      shopurl: shopURL
    })
/*  
    res.send({bc_auth_success: "success",
        query: req.query,
        body: req.body,
        response: response_data
    });
*/
    return true;
}
export async function bigcommerceLoad(req, res) {

    const shopURL = req.query.shop;
    console.log("will attempt to fecth the shop hash...");

    const dbClient = new MongoClient(process.env.MONGO_CLIENT_URL);
    const db = dbClient.db('openintegrations');

    const bigcommerceAppDocument = await db.collection("bigcommerceApp").findOne({APP_NAME: process.env.APP_NAME});

    var storehash = null;
    if (bigcommerceAppDocument) {

        const payload = {
            secret: bigcommerceAppDocument.API_SECRET,
            responseType: 'json'
        };
        console.log("payload: %o", payload);
        const bigCommerce = new BigCommerce(
            payload
        );
        const data = await bigCommerce.verify(req.query['signed_payload']);
        storehash = data.store_hash;
        console.log("bigcommerce returned auth data: %o", data);
    }
    res.render('index_bc', { 
      title: 'Open Integrations BigCommerce App', 
      shopurl: storehash
    });
//    res.send({bc_load_status: "success"});
};

export async function bigcommerceUninstall(req, res) { //}, _dbClient) {
    res.send({bc_uninstall_status: "success"});
}
export async function bigcommerceRemoveUser(req, res) { //}, _dbClient) {
    res.send({bc_removeuser_status: "success"});
}

