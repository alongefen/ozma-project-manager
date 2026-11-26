import { it, expect, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import * as actions from '../../../src/features/leads/logic/actions';
it('keeps every server entry point closed pending ISOLATION integration',async()=>{
 for(const action of Object.values(actions))expect(await action({} as never)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
});
