import { apiRequest, downloadFile } from '@/shared/lib/httpClient'
export type Proof={file_id:number;filename:string;sha256:string;locator?:string}
export type Control={source_hash:string;approved:boolean;handoff_id:number|null;signed_at:string|null;document:Proof|null;reason:string|null;responsible:{id:number;name:string}|null;can_sign:boolean;norm:{lines:{block_material_id:number;title:string;quantity:string;unit:string;block_id:number}[]}}
export type QueueHouse={production_id:number;house_name:string;client_name:string|null;remaining_positions:number;available_positions:number;shortage_positions:number;requested_positions:number;provided_positions:number;control:Control}
export type Queue={houses:QueueHouse[];can_edit:boolean;stock_anomalies:{material_id:number;title:string;stock:number;available:number;unit:string}[]}
export type ReturnRow={movement_id:number;production_id:number;house:string;material:string;unit:string;fractional:boolean;issued:string;returned:string;remaining:string;occurred_at:string;blocked_reason:string|null;returns:{id:number;quantity:string;operation_id:number;proof:Proof;intact:boolean}[]}
export const getControl=(id:number)=>apiRequest<Control>({section:'warehouse',path:`/control/houses/${id}`})
export const getQueue=()=>apiRequest<Queue>({section:'warehouse',path:'/control/queue'})
export const getReturns=()=>apiRequest<ReturnRow[]>({section:'warehouse',path:'/control/returns'})
export const signHandoff=(id:number,body:unknown)=>apiRequest<Control>({section:'warehouse',path:`/control/houses/${id}/handoff`,method:'POST',body})
export const postReturn=(id:number,body:unknown)=>apiRequest<{operation_id:number}>({section:'warehouse',path:`/control/returns/${id}`,method:'POST',body})
export function uploadProof(file:File){const form=new FormData();form.append('file',file);return apiRequest<Proof>({section:'warehouse',path:'/control/documents',method:'POST',form})}
export const downloadProof=(doc:Proof)=>downloadFile('warehouse',`/control/documents/${doc.file_id}`,doc.filename)
