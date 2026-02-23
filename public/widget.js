"use strict";(()=>{var F={org_id:"",display_name:"Support Assistant",welcome_message:"Hi! How can I help you today?",primary_color:"#2563eb",position:"bottom-right",avatar_url:null,powered_by:!0},N=()=>{let t=document.currentScript;if(t instanceof HTMLScriptElement&&t.dataset.orgId)return t;let r=Array.from(document.querySelectorAll("script[data-org-id]"));for(let s=r.length-1;s>=0;s-=1){let a=r[s];if(a instanceof HTMLScriptElement&&a.src.includes("widget.js"))return a}return null},P=t=>{try{return window.localStorage.getItem(t)}catch(r){return null}},R=(t,r)=>{try{window.localStorage.setItem(t,r)}catch(s){}},K=()=>typeof crypto!="undefined"&&typeof crypto.randomUUID=="function"?crypto.randomUUID():`visitor_${Math.random().toString(36).slice(2,10)}_${Date.now().toString(36)}`,V=t=>{let r=t.trim().split(/\s+/).filter(s=>s.length>0).slice(0,2);return r.length===0?"AI":r.map(s=>{var a,f;return(f=(a=s[0])==null?void 0:a.toUpperCase())!=null?f:""}).join("")},v=t=>t.endsWith("/")?t.slice(0,-1):t,G=t=>{if(t.dataset.apiBase&&t.dataset.apiBase.trim().length>0)return v(t.dataset.apiBase.trim());try{return v(new URL(t.src,window.location.href).origin)}catch(r){return v(window.location.origin)}},$=async()=>{var U;let t=N();if(!t){console.error("[SupportPilot] Could not find widget script tag.");return}let r=(U=t.dataset.orgId)==null?void 0:U.trim();if(!r){console.error("[SupportPilot] Missing required data-org-id attribute.");return}let s=G(t),a=`supportpilot:visitor:${r}`,f=`supportpilot:conversation:${r}`,b=P(a);b||(b=K(),R(a,b));let h=P(f),p=await(async()=>{var e;try{let i=await fetch(`${s}/api/widget/${encodeURIComponent(r)}`,{method:"GET"}),o=await i.json().catch(()=>null);if(!i.ok||!(o!=null&&o.data))throw new Error((e=o==null?void 0:o.error)!=null?e:"Failed to load widget config");return o.data}catch(i){return console.error("[SupportPilot] Falling back to default config.",i),{...F,org_id:r}}})(),l=document.createElement("div");l.setAttribute("data-supportpilot-widget",""),l.style.position="fixed",l.style.zIndex="2147483000",l.style.bottom="24px",l.style[p.position==="bottom-left"?"left":"right"]="24px",document.body.appendChild(l);let n=l.attachShadow({mode:"open"});n.innerHTML=`
    <style>
      :host, *, *::before, *::after {
        box-sizing: border-box;
      }

      .sp-root {
        --sp-primary: ${p.primary_color};
        --sp-bg: #ffffff;
        --sp-border: #dbe5ef;
        --sp-text: #0f172a;
        --sp-muted: #516074;
        --sp-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color: var(--sp-text);
      }

      .sp-bubble {
        width: 56px;
        height: 56px;
        border: none;
        border-radius: 9999px;
        background: linear-gradient(140deg, var(--sp-primary), #1d4ed8);
        color: #ffffff;
        font-size: 24px;
        cursor: pointer;
        box-shadow: var(--sp-shadow);
      }

      .sp-panel {
        width: min(380px, calc(100vw - 24px));
        height: min(560px, calc(100vh - 110px));
        margin-bottom: 12px;
        border-radius: 16px;
        border: 1px solid var(--sp-border);
        background: var(--sp-bg);
        box-shadow: var(--sp-shadow);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .sp-panel[hidden] {
        display: none;
      }

      .sp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        border-bottom: 1px solid var(--sp-border);
        background: linear-gradient(170deg, rgba(37, 99, 235, 0.08), rgba(16, 185, 129, 0.07));
      }

      .sp-title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .sp-avatar {
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background: var(--sp-primary);
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
      }

      .sp-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
      }

      .sp-title {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
      }

      .sp-subtitle {
        margin: 1px 0 0;
        font-size: 12px;
        color: var(--sp-muted);
      }

      .sp-close {
        border: none;
        background: transparent;
        color: var(--sp-muted);
        width: 30px;
        height: 30px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      }

      .sp-close:hover {
        background: rgba(15, 23, 42, 0.08);
      }

      .sp-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        background: #fbfdff;
      }

      .sp-message {
        max-width: 88%;
        margin-bottom: 12px;
        padding: 9px 11px;
        border-radius: 12px;
        white-space: pre-wrap;
        word-wrap: break-word;
        line-height: 1.45;
        font-size: 13px;
      }

      .sp-message.user {
        margin-left: auto;
        background: var(--sp-primary);
        color: #ffffff;
        border-bottom-right-radius: 4px;
      }

      .sp-message.assistant {
        margin-right: auto;
        background: #ffffff;
        border: 1px solid var(--sp-border);
        border-bottom-left-radius: 4px;
      }

      .sp-footer {
        border-top: 1px solid var(--sp-border);
        padding: 10px;
        background: #ffffff;
      }

      .sp-form {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .sp-input {
        flex: 1;
        border: 1px solid var(--sp-border);
        border-radius: 10px;
        padding: 10px 11px;
        font-size: 13px;
        outline: none;
      }

      .sp-input:focus {
        border-color: var(--sp-primary);
      }

      .sp-send {
        border: none;
        border-radius: 10px;
        background: var(--sp-primary);
        color: #ffffff;
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      .sp-send:disabled,
      .sp-input:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .sp-powered {
        margin-top: 8px;
        font-size: 11px;
        color: var(--sp-muted);
        text-align: center;
      }

      .sp-powered a {
        color: inherit;
      }

      @media (max-width: 520px) {
        .sp-panel {
          width: calc(100vw - 16px);
          height: min(70vh, 520px);
        }
      }
    </style>
    <div class="sp-root">
      <section class="sp-panel" hidden>
        <header class="sp-header">
          <div class="sp-title-wrap">
            <div class="sp-avatar"></div>
            <div>
              <p class="sp-title"></p>
              <p class="sp-subtitle">Typically replies in under a minute</p>
            </div>
          </div>
          <button class="sp-close" type="button" aria-label="Close chat">\xD7</button>
        </header>
        <div class="sp-messages" aria-live="polite"></div>
        <footer class="sp-footer">
          <form class="sp-form">
            <input class="sp-input" type="text" maxlength="4000" placeholder="Ask your question..." />
            <button class="sp-send" type="submit">Send</button>
          </form>
          <div class="sp-powered"></div>
        </footer>
      </section>
      <button class="sp-bubble" type="button" aria-label="Open chat">\u{1F4AC}</button>
    </div>
  `;let B=n.querySelector(".sp-root"),S=n.querySelector(".sp-panel"),E=n.querySelector(".sp-bubble"),C=n.querySelector(".sp-close"),T=n.querySelector(".sp-title"),w=n.querySelector(".sp-avatar"),c=n.querySelector(".sp-messages"),_=n.querySelector(".sp-form"),g=n.querySelector(".sp-input"),L=n.querySelector(".sp-send"),M=n.querySelector(".sp-powered");if(!(B instanceof HTMLElement)||!(S instanceof HTMLElement)||!(E instanceof HTMLButtonElement)||!(C instanceof HTMLButtonElement)||!(T instanceof HTMLElement)||!(w instanceof HTMLElement)||!(c instanceof HTMLElement)||!(_ instanceof HTMLFormElement)||!(g instanceof HTMLInputElement)||!(L instanceof HTMLButtonElement)||!(M instanceof HTMLElement)){console.error("[SupportPilot] Failed to initialize widget elements.");return}if(T.textContent=p.display_name,p.avatar_url){let e=document.createElement("img");e.src=p.avatar_url,e.alt=p.display_name,w.appendChild(e)}else w.textContent=V(p.display_name);if(p.powered_by){let e=document.createElement("a");e.href=s,e.target="_blank",e.rel="noopener noreferrer",e.textContent="Powered by SupportPilot",M.appendChild(e)}let H=!1,k=!1,I=!1,y=(e,i)=>{let o=document.createElement("div");return o.className=`sp-message ${e}`,o.textContent=i,c.appendChild(o),c.scrollTop=c.scrollHeight,o},q=e=>{k=e,g.disabled=e,L.disabled=e},A=e=>{H=e,S.hidden=!e,e&&!I&&(y("assistant",p.welcome_message),I=!0),e&&window.setTimeout(()=>g.focus(),30)},j=async e=>{var z;let i=e.trim();if(!i||k)return;y("user",i);let o=y("assistant","...");q(!0);try{let d=await fetch(`${s}/api/chat?org_id=${encodeURIComponent(r)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({org_id:r,visitor_id:b,conversation_id:h!=null?h:void 0,message:i})}),u=d.headers.get("x-conversation-id");if(u&&(h=u,R(f,u)),!d.ok){let m=await d.json().catch(()=>null);throw new Error((z=m==null?void 0:m.error)!=null?z:"Unable to send message")}if(!d.body){o.textContent="No response stream was returned.";return}let D=d.body.getReader(),W=new TextDecoder,x="";for(;;){let{done:m,value:O}=await D.read();if(m)break;x+=W.decode(O,{stream:!0}),o.textContent=x||"...",c.scrollTop=c.scrollHeight}x+=W.decode(),o.textContent=x.trim()||"I couldn't generate a response."}catch(d){let u=d instanceof Error?d.message:"Unexpected widget error";o.textContent=u}finally{q(!1),g.focus()}};_.addEventListener("submit",async e=>{e.preventDefault();let i=g.value;g.value="",await j(i)}),E.addEventListener("click",()=>A(!H)),C.addEventListener("click",()=>A(!1))};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{$()}):$();})();
