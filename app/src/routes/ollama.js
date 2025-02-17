import { ChatOllama } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

export var chatModel = null;

export async function apiOllamaSendMessageWS(ws, msg_obj) {
  try{
    const question = msg_obj.question;
    ws.send("sending the query langchain/ollama, please wait\n");

    const stream = await chatModel.stream([["human", question]]);
    for await (const chunk of stream){
      ws.send(chunk.content);
    }
    ws.send("<aitextdone />");
    console.log("sent the aitextdone tag to the client");

    return {
      content:{
        run_status:"executed",
        message_content:"check logs"
      }
    };
  } catch (err) {
    ws.send("failed to communicate with longchain/ollama, please contact the administrator for logs");
    ws.send("<aitextdone />");

    console.log("failed to invoke chain: %o", err);
    return {
      content:{
        run_status:"failed",
        message_content:err
      }
    };  

  }  
}

export async function apiOllamaTest(req, res) {
  console.log("making first query to ollama - deepseek");

  try{
    const outputParser = new StringOutputParser();

    var prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a world class technical documentation writer."],
      ["user", "what is LangSmith?"],
    ]);

    var chain = prompt.pipe(chatModel).pipe(outputParser);
    console.log("created chain from prompt template...");

    var response = await chain.invoke({input:"what is LangSmith?"});
    console.log("ollama response: %o", response);

    res.json({
      response
    });
    return;
  } catch (err) {
    console.log("failed to invoke chain: %o", err);
    const errMsg = err.message
    res.json({
      err:errMsg
    });
    return;
  }
}
export function initOllama() {
    console.log("initOllama");

    chatModel = new ChatOllama({
      baseUrl: "http://ollama:11434", // Default value
      model: "deepseek-r1",
      streaming: true
    });
    
    return chatModel;
};

  
