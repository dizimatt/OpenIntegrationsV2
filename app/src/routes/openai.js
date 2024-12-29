import OpenAI from "openai";

var openai = null;
var aiAssistantID = null;
var aiThreadID = null;
export {openai, aiAssistantID, aiThreadID};

export function initOpenAI() {
    console.log("initOpenAI");
    const myOpenai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    return openai = myOpenai;
};
export async function apiOpenAIRemoveAllAssistants(req, res){
    console.log("OpenAIRemoveAllAssistants");
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
              console.log("deleted assistant: %o", assistant.id);
            }
          }
          /*      
          return {
            content:{
              assistants_list:assistants_list.content.assistants,
              assistants_deleted:true
            }
          };
*/
        returnOBJ.data.assistants_deleted = true;
              
    } catch (err) {
        console.log("failed to call listAssistants!, %o", err);
    };
    res.json({
        returnOBJ
    });
    return true;
}

export async function apiOpenAITest(req, res) {
    console.log("apiOpenAITest");
    var assistantID = null;
    const returnOBJ = {};
    try{
    //    console.log("vectorStoreId: %s", vectorStoreId);
        const name = "Information Assistant";
        const instructions = "You are an information assistant. provide advice based on vector files provided. Please Address me as Matt";
    
        const assistant = await openai.beta.assistants.create({
        name: name,
        instructions: instructions,
        tools: [{ type: "file_search" }] ,
        model: "gpt-4o"
        });
        assistantID = assistant.id;
        returnOBJ.assistantID = assistant.id;
    
    } catch (err) {
        console.log("failed to call createAssistant!, %o", err);
        returnOBJ.error = err;
    };
    res.json({
        returnOBJ
    });
    return true;    
}

