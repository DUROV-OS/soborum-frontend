// Run manually against the owner's isolated loopback SIP peer. No carrier calls.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const exec = promisify(execFile)
const root = 'C:/Users/trans/OneDrive/Документы/ChatGPT/Пишем Durov OS'
const python = root + '/soborbum-backend/.venv/Scripts/python.exe'
async function rpc(operation) {
  return new Promise((resolve,reject) => {
    const child = execFile(python, ['-X','utf8',root+'/.ops/browser-calls-20261109/gateway_rpc.py'], { timeout: 190000 }, (error,stdout,stderr) => {
      if(error) reject(new Error(String(stderr || error))); else resolve(JSON.parse(stdout))
    })
    child.stdin.end(JSON.stringify(operation))
  })
}
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] })
let initialized = false
try {
  const context = await browser.newContext({ permissions: ['microphone'] })
  const page = await context.newPage()
  await page.route('http://127.0.0.1:5183/voice-transport', route => route.fulfill({ contentType:'text/html',body:'<!doctype html><title>Isolated voice transport test</title><p>Synthetic voice only</p>' }))
  await page.goto('http://127.0.0.1:5183/voice-transport')
  await rpc({op:'init'}); initialized = true
  const eventOf = event => event?.plugindata?.data?.result?.event
  async function waitForEvent(name) {
    for(let i=0;i<6;i++) {
      const result = await rpc({op:'poll'})
      const events = Array.isArray(result) ? result : [result]
      const found = events.find(event => eventOf(event)===name)
      if(found) return found
      if(events.some(event=>event.plugindata?.data?.error_code)) throw new Error('Synthetic gateway rejected operation: '+JSON.stringify(events))
    }
    throw new Error('Expected gateway event '+name)
  }
  await waitForEvent('registered')
  const offer = await page.evaluate(async () => {
    window.testPeer = new RTCPeerConnection()
    window.testMedia = await navigator.mediaDevices.getUserMedia({audio:true,video:false})
    window.testMedia.getTracks().forEach(track=>window.testPeer.addTrack(track,window.testMedia))
    await window.testPeer.setLocalDescription(await window.testPeer.createOffer())
    if(window.testPeer.iceGatheringState!=='complete') await new Promise(resolve=>window.testPeer.addEventListener('icegatheringstatechange',()=>{if(window.testPeer.iceGatheringState==='complete')resolve()}))
    return window.testPeer.localDescription.sdp
  })
  await rpc({op:'call',sdp:offer})
  const accepted = await waitForEvent('accepted')
  await page.evaluate(async jsep=>window.testPeer.setRemoteDescription(jsep),accepted.jsep)
  await rpc({op:'record'})
  await page.waitForFunction(async()=>{
    const stats=await window.testPeer.getStats()
    return [...stats.values()].some(item=>item.type==='inbound-rtp'&&item.kind==='audio'&&item.packetsReceived>100)
  },null,{timeout:25000})
  const stats = await page.evaluate(async()=>{
    const values=[...(await window.testPeer.getStats()).values()]
    return { state:window.testPeer.connectionState, inbound:values.filter(item=>item.type==='inbound-rtp').map(item=>({packets:item.packetsReceived,bytes:item.bytesReceived})),outbound:values.filter(item=>item.type==='outbound-rtp').map(item=>({packets:item.packetsSent,bytes:item.bytesSent})) }
  })
  await rpc({op:'hangup'}); await waitForEvent('hangup')
  const recording = await rpc({op:'convert'})
  assert.equal(stats.state,'connected'); assert.equal(recording.files.length,2)
  assert(recording.files.every(file=>file.duration>1 && file.bytes>1000))
  const report = { ok:true, carrier_calls:0, customer_data:false, transport:'real WebRTC DTLS/SRTP and loopback SIP/RTP',stats,recording }
  await writeFile(root+'/.ops/browser-calls-20261109/media-validation.json',JSON.stringify(report,null,2))
  console.log(JSON.stringify(report))
} finally { if(initialized) await rpc({op:'cleanup'}); await browser.close() }
