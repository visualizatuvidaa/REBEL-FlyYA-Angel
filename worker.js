// REBEL — FlyYA Maestro IA. Mantiene los assets existentes.
// Binding requerido: Workers AI con nombre AI. Binding de archivos: ASSETS.
const MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if(url.pathname === '/api/coach') {
      if(request.method !== 'POST') return json({error:'Usa POST para conversar con FlyYA.'},405);
      if(!env.AI || typeof env.AI.run !== 'function') return json({error:'Falta configurar Workers AI con binding AI.'},503);
      const len=Number(request.headers.get('content-length')||'0');
      if(len>12000)return json({error:'Mensaje demasiado largo.'},413);
      let body;
      try{const raw=await request.text();if(raw.length>12000)return json({error:'Solicitud demasiado larga.'},413);body=JSON.parse(raw);}catch{return json({error:'Solicitud JSON inválida.'},400);}
      const message=typeof body?.message==='string'?body.message.trim():'';
      const topic=typeof body?.topic==='string'?body.topic.slice(0,80):'música';
      const duration=Number(body?.duration) || 10;
      if(!message || message.length>1200)return json({error:'La pregunta debe tener entre 1 y 1200 caracteres.'},400);
      const conversation=Array.isArray(body?.history)?body.history.slice(-8).filter(m=>m && ['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,1500)})):[];
      const system=`Eres FlyYA Maestro IA, tutor musical paciente, práctico y entusiasta de Ángel, alumno principiante interesado en hardcore punk, metal y composición original. Responde en el idioma que use el alumno, de forma breve, clara, interactiva, con pasos concretos y una pregunta al final. Tema actual: ${topic}. Si el alumno desea guitarra, bajo, batería o teoría, enseña conceptos y prácticas progresivas de ese instrumento, sin asumir que dispone de equipo real. Tiempo sugerido: ${[10,20,30].includes(duration)?duration:10} minutos. Enseña progresivamente música, ritmo, batería, letras, composición, voz y ensayos. Propón una actividad breve y espera la respuesta del alumno antes de avanzar. Si envía letra propia, da comentarios precisos y respetuosos. JAMÁS afirmes haber escuchado o evaluado su voz, afinación, audio ni instrumentos si solo recibiste texto. No inventes calificaciones ni análisis acústicos. Si recibes medidas locales de audio (RMS, duración, actividad sonora, tono aproximado), limita tus inferencias a esas señales, explica incertidumbre y ofrece ejercicios seguros; nunca afirmes que escuchaste el audio. El canto extremo puede dañar la voz: propone calentamientos suaves, volumen cómodo y descansos; si hay dolor, pérdida de voz o ronquera, indica detenerse y consultar profesional. No reproduzcas letras protegidas de canciones existentes.`;
      try{
        const result=await env.AI.run(MODEL,{messages:[{role:'system',content:system},...conversation,{role:'user',content:message}],max_tokens:550,temperature:0.55});
        let reply=typeof result?.response==='string'?result.response:'';
        if(!reply && typeof result?.result?.response==='string')reply=result.result.response;
        if(!reply.trim()) return json({error:'El modelo no devolvió texto. Reintenta la solicitud.'},502);
        return json({reply:reply.trim()});
      }catch(e){console.error('FlyYA inference failed',String(e?.message||e));return json({error:'El servicio de IA no respondió. Verifica el modelo, el binding y la cuota disponible.'},503);}
    }
    if(url.pathname.startsWith('/api/'))return json({error:'Ruta no encontrada.'},404);
    return env.ASSETS.fetch(request);
  }
};
