import { LguMark } from '@/components/layout/Navbar';

/** sessionStorage key: the intro has played in this tab. */
export const INTRO_SEEN_KEY = 'lt-intro-seen';
/** Reveal the page by this long after navigation started, finished or not. */
const CAP_MS = 1500;

/**
 * The first-visit intro's driver, run inline right before the intro's markup
 * (so before the hero is parsed or painted). Without it the intro never shows:
 * no scripts, a repeat visit in this tab, or reduced motion all skip it.
 *
 * Progress is the share of real first-screen work done, out of
 * 2 + `critical` tasks: the display face (Anton, via document.fonts.load on
 * the family next/font assigned), the headline parsed and painted, and each
 * `img[data-critical]` wall photo loaded (or failed). The figure eases toward
 * that share and never runs backwards. At 100% it leaves; at CAP_MS after
 * navigation start it leaves wherever it is. A CSS failsafe hides it at 2.5 s
 * should the main thread be too busy for the timer.
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
var total=2+${critical},done=0,shown=0,left=false,el=null;
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
  if(done>=total&&shown>=99.5){if(el)el.textContent='100';setTimeout(leave,140);return;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setTimeout(leave,Math.max(0,${CAP_MS}-performance.now()));
}catch(e){document.documentElement.removeAttribute('data-intro');}})();`;
}

/**
 * Full-screen intro on the first visit in a tab: the LGU Tracker mark and a
 * 0–100% counter of the first screen's real loading. Server-rendered but
 * hidden unless its script marks <html>; decorative, so hidden from
 * assistive technology (the page is fully there underneath).
 */
export function Intro({ critical }: { critical: number }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: introScript(critical) }} />
      <div className="intro" aria-hidden="true">
        <div className="intro-panel">
          <div className="flex items-center gap-2.5">
            <LguMark className="w-8 h-8" />
            <span className="text-[18px] font-bold tracking-[-0.02em] text-white">LGU Tracker</span>
          </div>
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
