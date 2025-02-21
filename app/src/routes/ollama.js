import { ChatOllama, Ollama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import axios from 'axios';
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";

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

  
  
    
    const query = msg_obj.question;
    ws.send("sending the query langchain/ollama, please wait\n");

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are an expert extraction algorithm.
Only extract relevant information from the text.
If you do not know the value of an attribute asked to extract,
return null for the attribute's value.`,
      ],
//      ["user", "contextual information for the query: {context}, question: {input}"],
      ["user", "question: {input}"],
    ]);
    const chain = prompt.pipe(ollama);
    const stream = await chain.stream({
      input: query,
//      context: JSON.stringify(webContent),
    });
    

    /*
    const stream = await ollama.stream([
      new HumanMessage({
        content: [
          {
            type: "text",
            text: query,
          },
          {
            type: "text",
            text: JSON.stringify(context_data),
          },
        ],
      }),
    ]);
    */
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


    try{
    console.log("loading products.json");
    const loader = new TextLoader("./products.json");
    const docs = await loader.load();

    console.log("splitting docs");
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize:1000,
      chunkOverlap:200,
      separators:["\"id\""]
    });
    const splitDocs = await textSplitter.splitDocuments(docs);

    const embeddings = new OllamaEmbeddings({
      baseUrl: "http://ollama:11434", // Default value
      model: "deepseek-r1:1.5b"
    });

    console.log("creating vector store");
    const vectorStore = await MemoryVectorStore.fromDocuments(
      splitDocs, 
      embeddings,
      {
        chunkSize: 5000,
        chunkOverlap: 200
      }
    );

    console.log("creating retriever");
    const retriever = vectorStore.asRetriever();
    const prompt = PromptTemplate.fromTemplate(`
      Answer the question using ONLY the following context.
      If unsure, say "I don't know".
      
      Context:
      {context}

      Question: {question}

      Anwer:
    `);

    console.log("creating chain");
    const chain = RunnableSequence.from([
      {
        context: retriever.pipe(formatDocumentsAsString),
        question: new RunnablePassthrough(),
      },
      prompt,
      ollama
    ]);

    console.log("invoking chain");
    const answer = await chain.invoke("how many products are in the catalog?");

    console.log("answer: %s", answer);  

  } catch (err) {
    console.log("failed to invoke chain: %o", err);
  }


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

  
