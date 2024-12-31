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
            console.log("deleted assistant: %o", assistant.id);
            }
        }

        returnOBJ.data.assistants_deleted = true;
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

export async function apiOpenAISendMessage(req, res){
    console.log("apiOpenAISendMessage: req body: %o",req.body);
    res.json({
        message: {
            data: "this is a dummy message!"
        }
    });

//    res.sendStatus(202);
}

export async function createMainAssistant(){
    await OpenAIRemoveAllAssistants();
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
            console.log("main assistant id (aiAssistantID) : %s", aiAssistantID);
        
        } catch (err) {
            console.log("failed to execute createMainAssistant!, %o", err);
        };
        return true;        

}
