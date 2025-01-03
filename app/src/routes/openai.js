import OpenAI from "openai";
import {MongoClient} from 'mongodb';

var openai = null;
var aiAssistantID = null;
var aiThreadID = null;
export {openai, aiAssistantID, aiThreadID};

export function initOpenAI() {
    const myOpenai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    return openai = myOpenai;
};

export async function apiOpenAISendMessage(req, res){
    console.log("apiOpenAISendMessage");
    /*
    res.json({
        message: {
            data: "this is a dummy message!"
        }
    });
    */

    try{
        console.log("req.body: %o",req.body);
        const question = req.body.question;
    
        const message = await openai.beta.threads.messages.create(
            aiThreadID,
            {
              role: "user",
              content: question 
            }
        );
    
        let run = await openai.beta.threads.runs.createAndPoll(
            aiThreadID,
          { 
            assistant_id: aiAssistantID,
            instructions: `Please address the user as Matt. The user has a premium account.`
          }
        );
    
        let message_content = "";
        if (run.status !== 'completed') {
          while (run.status !== 'completed') {
            run = await openai.beta.threads.runs.poll(run.id);  
          }
        }
        // thread should have completed by this stage
        const messages = await openai.beta.threads.messages.list(
          run.thread_id
        );
        for (const message of messages.data.reverse()) {
          message_content = message_content + `${message.role} > ${message.content[0].text.value}\n`;
        }
    
        res.json({
            content:{
                run_status:run.status,
                message_content:message_content
            }
        });
        return {
          content:{
            run_status:run.status,
            message_content:message_content
          }
        };
    } catch (err) {
        console.log("failed to call sendmessage!, %s, %s", err.code, err.param);
        res.json({
            failed_message: err
        });
        return "error in sending the message: " + err;
    };
//    res.sendStatus(202);
}

async function OpenAICreateMainThread(){
    const client = new MongoClient(process.env.MONGO_CLIENT_URL);
    await client.connect();

    //    const db = dbClient.db('openintegrations');
    const db = client.db('openintegrations');

    var myReturn = {}
    var threadsQuery = {}

    const aIThread = await db.collection('threads').findOne(threadsQuery);
    if (aIThread){
        aiThreadID = aIThread.id;
    } else {
        try{
            const myThread = await openai.beta.threads.create();
            aiThreadID = myThread.id;
            try{
                db.collection('threads').insertOne(myThread);
            } catch (err) {
                console.log("failed to insert aithread object into collection!, %o", err);
            }
            myReturn = myThread;
        } catch (err) {
            console.log("OpenAICreateMainThread: failed to create main thread!, %o", err);
        }
    }

    return myReturn;
}

async function OpenAIRemoveAllAssistants(){
    const client = new MongoClient(process.env.MONGO_CLIENT_URL);
    await client.connect();

//    const db = dbClient.db('openintegrations');
    const db = client.db('openintegrations');

    const returnOBJ = {
        data: {
            assistant_id: null,
            thread_id: null,
            assistant_deleted: false,
            thread_deleted: false
        }
    };

    if (aiAssistantID != null){
        try{
            await openai.beta.assistants.del(aiAssistantID);
            await db.collection('assistants').deleteOne({id: aiAssistantID});
            returnOBJ.data.assistant_id = aiAssistantID;
            returnOBJ.data.assistants_deleted = true;
            aiAssistantID = null;
        } catch (err) {
            console.log("OpenAIRemoveAllAssistants: failed to delete main Assistant (id: %s) from mongodb!, %o", aiThreadID, err);
        }
    }
    if (aiThreadID != null){
        try{
            await db.collection('threads').deleteOne({id: aiThreadID});
            await openai.beta.threads.del(aiThreadID);
            returnOBJ.data.thread_id = aiThreadID;
            returnOBJ.data.thread_deleted = true;
            aiThreadID = null;
        } catch (err) {
            console.log("OpenAIRemoveAllAssistants: failed to delete main thread (id: %s)!, %o",aiThreadID, err);
        }
    }
    return returnOBJ;
}
export async function apiOpenAIRemoveAllAssistants(req, res){
    try{
        const returnOBJ = await OpenAIRemoveAllAssistants();
        res.json({
            returnOBJ
        });
        } catch (err) {
        console.log("failed to call OpenAIRemoveAllAssistants!, %o", err);
    };
    return true;
}
export async function createMainAssistant(dbClient){
    const client = new MongoClient(process.env.MONGO_CLIENT_URL);
    await client.connect();

//    const db = dbClient.db('openintegrations');
    const db = client.db('openintegrations');

    console.log("createMainAssistant: fetching/creating main assistant, will be used for future threads");
    var assistantsQuery = {}
    const aIAssistant = await db.collection('assistants').findOne(assistantsQuery);
    if (aIAssistant){
        aiAssistantID = aIAssistant.id;
    } else {
        try{
            //    console.log("vectorStoreId: %s", vectorStoreId);
            const name = "Information Assistant";
            const instructions = "You are an information assistant. provide advice based on vector files provided.";
        
            const assistant = await openai.beta.assistants.create({
                name: name,
                instructions: instructions,
                tools: [{ type: "file_search" }] ,
                model: "gpt-4o"
            });
            aiAssistantID = assistant.id;
            try{
                db.collection('assistants').insertOne(assistant);            
            } catch (err) {
                console.log("failed to insert assistant object into collection!, %o", err);                
            }
        } catch (err) {
            console.log("failed to execute createMainAssistant!, %o", err);
        };
    }

    const aIThreadObj = await OpenAICreateMainThread();
return true;        

}
