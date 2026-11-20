import Image from 'next/image';

/** sessionStorage key: the intro has played in this tab. */
export const INTRO_SEEN_KEY = 'lt-intro-seen';
/** Reveal the page by this long after navigation started, finished or not. */
const CAP_MS = 2000;
/** The brand sequence (logo, name, highlight) needs this long on screen before the panel may leave. */
const MIN_SHOW_MS = 1500;

/**
 * The first-visit intro's driver, run inline right before the intro's markup
 * (so before the hero is parsed or painted). Without it the intro never shows:
 * no scripts, a repeat visit in this tab, or reduced motion all skip it.
 *
 * Progress is the share of real first-screen work done, out of
 * 2 + `critical` tasks: the display face (Anton, via document.fonts.load on
 * the family next/font assigned), the headline parsed and painted, and each
 * `img[data-critical]` wall photo loaded (or failed). The figure eases toward
 * that share and never runs backwards. Meanwhile the brand plays: the mark
 * pops in, BANTAY PROYEKTO rises, and a highlighter sweeps over PROYEKTO. The
 * panel leaves at 100% but never before the sequence has had MIN_SHOW_MS; at
 * CAP_MS after navigation start it leaves wherever it is. A CSS failsafe hides
 * it at 3.2 s should the main thread be too busy for the timer.
 *
 * If the script itself only runs within 400 ms of the cap (a slow
 * connection), the intro is skipped rather than flashed.
 *
 * Exit: html[data-intro] goes from "" to "out" (the counter slides up, the
 * panel wipes away, the headline's rise starts), then is removed.
 */
function introScript(critical: number) {
  return `(function(){try{
var d=document.documentElement;
// Too late to be worth a panel (a slow load already past the cap): skip it, no flash.
if(performance.now()>${CAP_MS - 400}||sessionStorage.getItem(${JSON.stringify(INTRO_SEEN_KEY)})||!matchMedia('(prefers-reduced-motion: no-preference)').matches)return;
sessionStorage.setItem(${JSON.stringify(INTRO_SEEN_KEY)},'1');
d.setAttribute('data-intro','');
var total=2+${critical},done=0,shown=0,left=false,el=null,t0=performance.now();
function tick(){done++;}
function task(p){p.then(tick,tick);}
var parsed=new Promise(function(r){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',r):r();});
task(parsed.then(function(){
  var l=document.querySelector('.landing');
  var fam=l&&getComputedStyle(l).getPropertyValue('--font-anton');
  return fam&&document.fonts?document.fonts.load('400 1em '+fam):null;
}));
task(parsed.then(function(){return new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r);});});}));
parsed.then(function(){
  var list=document.querySelectorAll('img[data-critical]'),n=0;
  for(var i=0;i<list.length&&n<${critical};i++,n++)(function(im){
    if(im.complete)tick();else{im.addEventListener('load',tick,{once:true});im.addEventListener('error',tick,{once:true});}
  })(list[i]);
  done+=${critical}-n;
});
function leave(){
  if(left)return;left=true;
  d.setAttribute('data-intro','out');
  setTimeout(function(){d.removeAttribute('data-intro');},900);
}
function frame(){
  if(left)return;
  el=el||document.getElementById('intro-count');
  var target=100*done/total;
  if(target>shown)shown+=Math.max((target-shown)*0.14,0.6);
  if(shown>target)shown=target;
  if(el)el.textContent=String(Math.floor(shown));
  if(done>=total&&shown>=99.5){if(el)el.textContent='100';setTimeout(leave,Math.max(140,${MIN_SHOW_MS}-(performance.now()-t0)));return;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setTimeout(leave,Math.max(0,${CAP_MS}-performance.now()));
}catch(e){document.documentElement.removeAttribute('data-intro');}})();`;
}

/**
 * Full-screen intro on the first visit in a tab: the Bantay Proyekto mark and
 * name with a highlighter sweep over "Proyekto", and a 0–100% counter of the
 * first screen's real loading. Server-rendered but
 * hidden unless its script marks <html>; decorative, so hidden from
 * assistive technology (the page is fully there underneath).
 */
export function Intro({ critical }: { critical: number }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: introScript(critical) }} />
      <div className="intro" aria-hidden="true">
        <div className="intro-panel">
          <div className="intro-brand">
            <Image src="/brand/icon-192.png" alt="" width={192} height={192} sizes="84px" priority className="intro-logo" />
            <p className="intro-word display">
              <span className="intro-w1">Bantay</span>{' '}
              <span className="intro-w2 intro-hl">Proyekto</span>
            </p>
          </div>
          <div />
          <div className="intro-mask display">
            <span className="intro-count">
              {/* The script writes this figure before hydration; React never owns its text. */}
              <span id="intro-count" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: '0' }} />
              <span className="text-signal">%</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
