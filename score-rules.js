(function(root){
 function validate(s1,s2,tb1,tb2,rules={games:4,tiebreak:7,advantage:false}) {
  if(!Number.isInteger(s1)||!Number.isInteger(s2)||s1<0||s2<0)return 'Informe games inteiros e não negativos.';
  if(s1===s2)return 'A partida precisa ter um vencedor. Confira o placar.';
  if(rules===null){
   if((tb1===null)!==(tb2===null))return 'Preencha os dois pontos do tie-break ou deixe ambos em branco.';
   if(tb1!==null && (!Number.isInteger(tb1)||!Number.isInteger(tb2)||tb1<0||tb2<0||tb1===tb2||(s1>s2)!==(tb1>tb2)))return 'Confira os pontos e o vencedor do tie-break.';
   return '';
  }
  const win=Math.max(s1,s2),lose=Math.min(s1,s2),target=Number(rules.games);
  if(win!==target||lose>=target)return `O placar final deve ter ${target} games para o vencedor e de 0 a ${target-1} para o adversário.`;
  const has1=tb1!==null,has2=tb2!==null;
  if(has1!==has2)return 'Preencha os dois pontos do tie-break ou deixe ambos em branco.';
  if(has1){
   if(!Number.isInteger(tb1)||!Number.isInteger(tb2)||tb1<0||tb2<0)return 'Informe pontos inteiros e não negativos no tie-break.';
   if(lose!==target-1)return `Só informe tie-break no placar ${target} × ${target-1}.`;
   const w=Math.max(tb1,tb2),l=Math.min(tb1,tb2),t=Number(rules.tiebreak);
   if(rules.advantage ? !(w>=t && w-l>=2 && (w===t||w-l===2)) : !(w===t&&l<t))return rules.advantage?`Tie-break até ${t}, com diferença de dois pontos.`:`Tie-break até ${t}, sem vantagem (ponto decisivo).`;
   if((s1>s2)!==(tb1>tb2))return 'O vencedor do tie-break precisa ser o vencedor da partida.';
  }
  return '';
 }
 root.ScoreRules={validate};if(typeof module!=='undefined')module.exports=root.ScoreRules;
})(typeof window==='undefined'?globalThis:window);
