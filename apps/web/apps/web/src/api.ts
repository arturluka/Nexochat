export async function api(path:string,method='GET',body?:unknown):Promise<any>{
 const response=await fetch('/api'+path,{method,credentials:'include',headers:body instanceof FormData?{}:body?{'Content-Type':'application/json'}:{},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Não foi possível concluir'),{status:response.status});return data;
}
