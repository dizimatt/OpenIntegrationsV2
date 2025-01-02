import OpenAI from "openai";

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

async function OpenAIRemoveMainThread(){
    if (aiThreadID != null){
        try{
            await openai.beta.threads.del(aiThreadID);
        } catch (err) {
            console.log("OpenAIRemoveMainThread: failed to delete main thread!, %o", err);
        }
        aiThreadID = null;
        return true;
    }
}
async function OpenAICreateMainThread(){
    try{
        const myThread = await openai.beta.threads.create();
        aiThreadID = myThread.id;
    } catch (err) {
        console.log("OpenAICreateMainThread: failed to create main thread!, %o", err);
    }

    return true;
}

async function OpenAIRemoveAllAssistants(){
    const returnOBJ = {
        data: {
            assistants_list: [],
            assistants_deleted: false
        }
    };

    try{
        const assistants_list = await openai.beta.assistants.list();
        returnOBJ.data.assistants_list = assistants_list.data;

        if (assistants_list.data.length != 0){
            for (const assistant of assistants_list.data) {
                await openai.beta.assistants.del(assistant.id);
            }
        }
        returnOBJ.data.assistants_deleted = true;
        await OpenAIRemoveMainThread();

    } catch (err) {
        console.log("OpenAIRemoveAllAssistants: failed to delete all Assistants!, %o", err);
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
export async function createMainAssistant(){
    await OpenAIRemoveAllAssistants();
    await OpenAICreateMainThread();
    console.log("createMainAssistant: creating main assistant, will be used for future threads");
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
        
        } catch (err) {
            console.log("failed to execute createMainAssistant!, %o", err);
        };
        return true;        

}
