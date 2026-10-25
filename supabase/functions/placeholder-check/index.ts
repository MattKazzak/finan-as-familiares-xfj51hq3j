import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import 'jsr:@std/assert@1'
console.log('placeholder-check v2: estrutura correta')
Deno.serve((req) => new Response('ok'))
