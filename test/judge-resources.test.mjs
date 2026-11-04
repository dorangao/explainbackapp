import {judgeResourceContract} from '../test-support/judge-resource-contract.mjs';
import {createMemoryState} from '../src/state.mjs';
import {createTesterAuth} from '../src/tester-auth.mjs';
import {createMemoryJudgeStore} from '../src/judge-access.mjs';
judgeResourceContract('memory',async()=>({state:createMemoryState(),auth:createTesterAuth({username:'test',password:'synthetic-only-password'}),judgeStore:createMemoryJudgeStore()}));
