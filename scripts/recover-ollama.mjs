import {createProviderRouter} from '../src/llm/index.mjs';
try{await createProviderRouter().recover();console.log('Managed local models unloaded and verified; ExplainBack uncertainty block cleared.');}
catch(error){console.error(['OLLAMA_BUSY','OLLAMA_OTHER_MODEL','OLLAMA_CONTROL'].includes(error.code)?error.message:'Recovery could not verify Ollama state; local generation remains blocked.');process.exitCode=1;}
