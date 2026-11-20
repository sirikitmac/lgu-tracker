import Image from 'next/image';
import { BrandWordmark } from '@/components/ui/BrandWordmark';

/** sessionStorage key: the intro has played in this tab. */
export const INTRO_SEEN_KEY = 'lt-intro-seen';
/** Reveal the page by this long after navigation started, finished or not. */
const CAP_MS = 2400;
/** The brand sequence (logo, name, highlight) needs this long on screen before the panel may leave. */
const MIN_SHOW_MS = 1900;

/**
 * The first-visit intro's driver, run inline right before the intro's markup
 * (so before the hero is parsed or painted). Without it the intro never shows:
 * no scripts, a repeat visit in this tab, or reduced motion all skip it.
 *
 * The brand plays on its own: the mark comes into focus, then the wordmark
 * wipes in. The panel leaves only when the first screen's real work is done,
 * out of 2 + `critical` tasks (the display face via document.fonts.load, the
 * headline parsed and painted, and each `img[data-critical]` wall photo loaded
 * or failed), and never before MIN_SHOW_MS so the sequence can finish. At
 * CAP_MS after navigation start it leaves regardless. A CSS failsafe hides it
 * at 3.5 s should the main thread be too busy for the timer.
 *
 * If the script itself only runs within 400 ms of the cap (a slow
 * connection), the intro is skipped rather than flashed.
 *
 * Exit: html[data-intro] goes from "" to "out" (the panel fades away, the
 * headline's rise starts), then is removed.
 */
function introScript(critical: number) {
  return `(function(){try{
var d=document.documentElement;
// Too late to be worth a panel (a slow load already past the cap): skip it, no flash.
if(performance.now()>${CAP_MS - 400}||sessionStorage.getItem(${JSON.stringify(INTRO_SEEN_KEY)})||!matchMedia('(prefers-reduced-motion: no-preference)').matches)return;
sessionStorage.setItem(${JSON.stringify(INTRO_SEEN_KEY)},'1');
d.setAttribute('data-intro','');
var total=2+${critical},done=0,left=false,armed=false,t0=performance.now();
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
  setTimeout(function(){d.removeAttribute('data-intro');},800);
}
function frame(){
  if(left)return;
  if(done>=total&&!armed){armed=true;setTimeout(leave,Math.max(140,${MIN_SHOW_MS}-(performance.now()-t0)));return;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setTimeout(leave,Math.max(0,${CAP_MS}-performance.now()));
}catch(e){document.documentElement.removeAttribute('data-intro');}})();`;
}

/**
 * Full-screen intro on the first visit in a tab: the Bantay Proyekto mark
 * comes into focus, then the wordmark wipes in. Server-rendered but hidden
 * unless its script marks <html>; decorative, so hidden from assistive
 * technology (the page is fully there underneath).
 */
export function Intro({ critical }: { critical: number }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: introScript(critical) }} />
      <div className="intro" aria-hidden="true">
        <div className="intro-panel">
          <Image src="/brand/icon-192.png" alt="" width={192} height={192} sizes="96px" priority className="intro-logo" />
          <div className="intro-word">
            <BrandWordmark sizes="(min-width: 640px) 360px, 70vw" />
          </div>
        </div>
      </div>
    </>
  );
}
