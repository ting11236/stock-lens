'use strict';
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function monthStart(asOf){
 const d=new Date(asOf+'T00:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);
}
function recentPublishedMeetingSummaries(entries,profiles,asOf){
 if(!validDate(asOf))throw Error('Invalid summary calendar date');
 const cutoff=monthStart(asOf),byMeeting=new Map();
 for(const e of entries||[]){
  const p=profiles?.[e.symbol],m=p?.meeting_research;
  if(!/^\d{4}\.TW$/.test(e.symbol||'')||!p||!e.name||!['法說會','股東會'].includes(e.kind)||!e.batch_id)continue;
  if(e.website_adopted!==true||e.published!==true||e.live_verified!==true||e.summary_verified!==true)continue;
  if(!m||m.batch_id!==e.batch_id||!['meeting_complete','meeting_complete_with_disclosed_gaps'].includes(m.status)||m.event_date!==e.meeting_date)continue;
  if(!validDate(e.summary_updated_at)||!validDate(e.meeting_date)||e.summary_updated_at<cutoff||e.summary_updated_at>asOf||e.meeting_date>asOf||e.summary_updated_at<e.meeting_date)continue;
  const key=e.symbol+'|'+e.kind+'|'+e.meeting_date,prior=byMeeting.get(key);
  if(!prior||e.summary_updated_at>prior.summary_updated_at)byMeeting.set(key,{symbol:e.symbol,name:p.name||e.name,kind:e.kind,meeting_date:e.meeting_date,summary_updated_at:e.summary_updated_at,batch_id:e.batch_id});
 }
 return [...byMeeting.values()].sort((a,b)=>b.summary_updated_at.localeCompare(a.summary_updated_at)||b.meeting_date.localeCompare(a.meeting_date)||a.symbol.localeCompare(b.symbol));
}
module.exports={recentPublishedMeetingSummaries,monthStart};
