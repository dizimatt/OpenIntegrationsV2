import { ChatOllama, Ollama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import axios from 'axios';
import { TextLoader } from "langchain/document_loaders/fs/text";


var ollama = new ChatOllama();
var webContent = "";

async function fetchWebHTML(url) {
  const { data } = await axios.get(url);
//  console.log("data (string): %s", JSON.stringify(data) );
  return data;
 // Adjust the selector as needed
}

export async function apiOllamaSendMessageWS(ws, msg_obj) {
  try{
  
    const loader = new TextLoader("./products.json");
    const originalDocs = await loader.load();
    const docs = [originalDocs[0].pageContent];

    const query = msg_obj.question;
    ws.send("sending the query langchain/ollama, please wait\n");

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful assistant.
        If you do not know the answer of the question asked, please respond with "I don't know".`,
      ],
//      ["user", "question: {input}, \n context: {context}, \n\nAnswer"],
      ["user", "question: {input}, \n\nAnswer"],
    ]);
    const chain = prompt.pipe(ollama);
    const stream = await chain.stream({
      input: query,
//      context: docs
    });
    
    for await (const chunk of stream){
      ws.send(chunk.content);
    }
    // end of original directions...

    ws.send("\nfinished the response\n");
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

export async function initOllama() {
    console.log("initOllama");
    ollama = new ChatOllama({
      baseUrl: "http://ollama:11434", // Default value
      model: "deepseek-r1:1.5b",
      streaming: true,
      options: {
        num_ctx: 100000
      }   
    });

    //start of original directions
    const url = 'https://bushrangerhoney.com.au/products.json';
    webContent = await fetchWebHTML(url);

    webContent.products.forEach(product => {
      product.price = product.variants[0].price;
      delete product.variants
      delete product.images;
    }, this);

//    console.log("webContent: %o", webContent);

    return ollama;
};

  
