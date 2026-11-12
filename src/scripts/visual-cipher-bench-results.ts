type Row = [string,string,number,number,number,number,number,number];
type Metric = {id:string;label:string;column:number;attempts:number};
const payload = document.getElementById('vcb-result-data');
if (payload) {
  const data = JSON.parse(payload.textContent!) as {results:Row[];modelStyles:Record<string,{color:string;logo:string;vendor:string}>;metricOptions:Metric[];logoBase:string};
  const metricSelect = document.getElementById('result-metric') as HTMLSelectElement;
  const scaleSelect = document.getElementById('result-scale') as HTMLSelectElement;
  const bars = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-result-index]'));
  let activeIndex = 0;
  const currentMetric = () => data.metricOptions.find(metric=>metric.id===metricSelect.value)!;
  const showConfiguration = (index:number) => {
    activeIndex=index;
    const row=data.results[index];
    const style=data.modelStyles[row[0]];
    document.getElementById('config-readout')!.style.setProperty('--model-color',style.color);
    const logo=document.getElementById('readout-logo') as HTMLImageElement;
    logo.src=data.logoBase+style.logo+'.svg';logo.alt=style.vendor;
    document.getElementById('readout-model')!.textContent=row[0];
    document.getElementById('readout-effort')!.textContent=`${row[1]} effort · ${row[6].toFixed(1)} / 40 mean solved`;
    document.querySelectorAll<HTMLElement>('[data-readout-column]').forEach(cell=>{
      cell.replaceChildren(document.createTextNode(Number(row[Number(cell.dataset.readoutColumn)]).toFixed(1)),Object.assign(document.createElement('small'),{textContent:'%'}));
    });
    bars.forEach(bar=>bar.setAttribute('aria-pressed',String(Number(bar.dataset.resultIndex)===index)));
  };
  const updateChart = () => {
    const metric=currentMetric();
    const max=Math.max(...data.results.map(row=>Number(row[metric.column])));
    // Nice, explicit axes starting at zero; full scale stays fixed across views.
    const ceiling=scaleSelect.value==='full'?100:max<=5?5:max<=20?20:max<=30?30:max<=50?50:100;
    const ticks=ceiling===30?[30,20,10,0]:Array.from({length:6},(_,i)=>ceiling-i*ceiling/5);
    const grid=document.querySelector('.vcb-gridlines')!;
    grid.replaceChildren(...ticks.map((tick,i)=>{
      const line=document.createElement('div');line.dataset.resultTick='';line.style.top=`${i/(ticks.length-1)*100}%`;
      const label=document.createElement('span');label.textContent=String(tick);line.append(label);return line;
    }));
    bars.forEach(bar=>{
      const row=data.results[Number(bar.dataset.resultIndex)],score=Number(row[metric.column]);
      bar.style.setProperty('--score-height',`${score/ceiling*100}%`);
      bar.querySelector('.vcb-config-value')!.textContent=score.toFixed(1);
      bar.setAttribute('aria-label',`${row[0]}, ${row[1]} effort: ${score.toFixed(1)}% ${metric.label} accuracy. Show configuration details.`);
    });
    document.getElementById('result-context')!.textContent=`Mean accuracy (%) · ${metric.attempts} attempts per configuration`;
    document.getElementById('result-scale-note')!.textContent=`Axis: 0–${ceiling}%.`;
    document.querySelectorAll<HTMLElement>('[data-score-metric]').forEach(cell=>cell.classList.toggle('is-current',cell.dataset.scoreMetric===metric.id));
    showConfiguration(activeIndex);
  };
  bars.forEach((bar,position)=>{
    const show=()=>showConfiguration(Number(bar.dataset.resultIndex));
    bar.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')show();});
    bar.addEventListener('focus',show);
    bar.addEventListener('click',show);
    bar.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?bars.length-1:(position+(event.key==='ArrowRight'?1:-1)+bars.length)%bars.length;
      bars[next].focus();
    });
  });
  metricSelect.addEventListener('change',updateChart);
  scaleSelect.addEventListener('change',updateChart);
}
