import {Db, MongoClient} from 'mongodb';
import axios, { all } from 'axios';
import BigCommerce from 'node-bigcommerce';
import { readFile } from "node:fs/promises";
import fs, { truncate } from 'fs';
import * as url from "url";

const file_dir = import.meta.dirname;
//console.log(filePath);

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
    const app_document = await db.collection("bigcommerceApp").findOne({
        APP_NAME: process.env.APP_NAME
    });
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
    console.log("will attempt to fetch the shop hash...");

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
        try{
            const bigCommerce = new BigCommerce(
                payload
            );
            const data = await bigCommerce.verify(req.query['signed_payload']);
            storehash = data.store_hash;
            console.log("bigcommerce returned auth data: %o", data);
        } catch (error) {
            console.log("warning: store_hash could not be fetched, continuing without: %o", error);
            if (req.query.shop){
                storehash = req.query.shop;
            }       
        }
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
async function apiBigcommercePlaceWidget(shop_name, widget_uuid, access_token) { //}, _dbClient) {
    console.log("widget uuid: %s", widget_uuid);
    try {
        const post_data = 
        {
            "widget_uuid": widget_uuid,
            "sort_order": 1,
            "region": "header_bottom",
            "template_file": "pages/home",
            "status": "active"
        };
        const headers = {
            'X-Auth-Token': access_token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          };
        const call_response = await axios.post(`https://api.bigcommerce.com/stores/${shop_name}/v3/content/placements`, 
            post_data, 
            {headers:headers}
        );
        return {
            status: "success",
            data: call_response.data.data
        }    

    }   catch (error) {
        console.log("api_bc_createwidget error: %o", error.response);
        return {
            status: "failed",
            data: error.response
        }
    }

};

async function apiBigcommerceCreateWidget(shop_name, template_uuid, access_token) { //}, _dbClient) {
    console.log("template uuid: %s", template_uuid);
    try {
        const post_data = {
            "name": "Widget Header Images (OpenIntegrations)",
            "template": "", //"{{#each images}}<a href='{{image_url}}'><img src={{image_source}} style='width:33.3%'/></a>{{/each}}",
            "widget_configuration": {
                "images": [{
                    "image_source": "https://cdn11.bigcommerce.com/s-n0i50vy/images/stencil/1280x1280/products/109/361/kinfolkessentialissue_1024x1024__22507.1456436715.jpg?c=2&imbypass=on"
                    },
                    {
                    "image_source":"https://cdn11.bigcommerce.com/s-n0i50vy/images/stencil/500x659/products/85/282/livingwithplants_grande__26452.1456436666.jpg?c=2&imbypass=on"
                    },
                    {
                        "image_source":
                        "https://cdn11.bigcommerce.com/s-n0i50vy/images/stencil/1280x1280/products/109/361/kinfolkessentialissue_1024x1024__22507.1456436715.jpg?c=2&imbypass=on"
                    }
                ]
            },
            "widget_template_uuid": template_uuid
        }
        const headers = {
            'X-Auth-Token': access_token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          };
        const call_response = await axios.post(`https://api.bigcommerce.com/stores/${shop_name}/v3/content/widgets`, 
            post_data, 
            {headers:headers}
        );
        return {
            status: "success",
            data: call_response.data.data
        }    

    }   catch (error) {
        console.log("api_bc_createwidget error: %o", error.response);
        return {
            status: "failed",
            data: error.response
        }
    }

};
export async function apiBigcommerceInitChatgptWidget(req, res, _dbClient) {
    const shop_name = req.query.shop;

    const db = _dbClient.db('openintegrations');
    const bcSession = await db.collection("bigcommerceSession").findOne({
        APP_NAME: process.env.APP_NAME,
        context: `stores/${shop_name}`
    });

    if (!bcSession){
        // you cannot do this if the store cannot be looked up
        console.log("cannot lookup bc app:%s, store:%s", process.env.APP_NAME, shop_name);
        res.send({api_bc_addwidgettemplate_status: "failed"});
        return;
    }

    var filedata = null;
    try {
        const fileUrl = new URL("/app/views/bc-templates/openwidget.html", import.meta.url);
        filedata = await readFile(fileUrl, { encoding: "utf8" });
        console.log("filedata: %o", filedata);
    } catch (error) {
        console.log("error: %o", error);
    }
    try{
        const post_data = {
            "name": "Header Images (OpenIntegrations)",
            "template": filedata //"{{#each images}}<a href='{{image_url}}'><img src={{image_source}} style='width:33.3%'/></a>{{/each}}"
        };
        const headers = {
            'X-Auth-Token': bcSession.access_token, //'g1342jmaig023adk1o9kmaqjz3pd7dq',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        console.log("headers: %o", headers);
        const url = `https://api.bigcommerce.com/stores/${shop_name}/v3/content/widget-templates`
        console.log("url: %s", url);
      
        const widget_templates_response = await axios.post(url, 
            post_data, 
            {headers:headers}
        );
        const widget_templates_response_data = widget_templates_response.data.data;
        const template_uuid = widget_templates_response_data.uuid;

        const response_data = {
            widget_templates_response_data: widget_templates_response_data
        };

        try{
            const create_widget_response = await apiBigcommerceCreateWidget(shop_name, template_uuid, bcSession.access_token);
            response_data.create_widget_response_data = create_widget_response.data;
            const widget_uuid = create_widget_response.data.uuid;

            const place_widget_response = await apiBigcommercePlaceWidget(shop_name, widget_uuid, bcSession.access_token);
            response_data.place_widget_response_data = place_widget_response.data;

        } catch (error) {
            console.log("apiBigcommerceCreateWidget error: %o", error.response);
            response_data.create_widget_response_data = error.response;
        }

        res.send({response_data});

    } catch (error) {
        console.log("apiBigcommerceInitChatgptWidget error: %o", error);
        res.send({api_bc_addwidgettemplate_status: "failed"});
    }

};

