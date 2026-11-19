import { spawnSync } from 'node:child_process';
import { expect,test } from '@playwright/test';
test('HTTP authority rejects forgery and protects confidential offers',async({baseURL},testInfo)=>{
 test.skip(process.env.E2E_BACKEND!=='1'||testInfo.project.name!=='desktop','Real local backend checked once');
 const result=spawnSync(process.execPath,['--test','tests/integration/http.test.mjs'],{encoding:'utf8',timeout:60000,env:{...process.env,INTEGRATION_BASE_URL:baseURL}});
 expect(result.status,`${result.stdout}\n${result.stderr}`).toBe(0);
});
