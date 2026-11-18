# Beyond the Container — Civo Workshop · 26 Nov 2026

**Running Highly Available & Scalable Applications with Kubernetes**
Hands-on mission race on your own Civo Kubernetes cluster, Jakarta region (JKT1).

You build everything on **your own Civo account**: first the cluster, then you take **NusaMart**,
a small e-commerce shop, from "it runs" to "it survives a 12.12 flash sale" — as fast as you can.

## Before you start

1. **Your own Civo account** (required to register): <https://dashboard.civo.com/signup> — verify email
   and phone and add a credit/debit card (not prepaid/virtual). New accounts get $250 credit.
2. **Register in Civo Launchpad** at **<https://s.id/civo-launchpad>** with your name, email and Civo account.
3. **A laptop with a browser.** That's it if you use the **Launchpad Shell** (recommended): a Linux terminal in
   your browser with `kubectl`, `git` and this repo ready — same on Windows, Mac and Linux, no API key needed.

Prefer your own terminal? Then also bring the `civo` CLI, `kubectl` and `git`, an API key (Profile → Security →
API keys; it stays on your laptop) and clone this repo: `git clone https://github.com/dev-cer/beyond-the-container`.
On Windows use **PowerShell 7** (`winget install Microsoft.PowerShell`, then `pwsh`) or Git Bash — Windows
PowerShell 5.1 drops the quotes inside JSON arguments. In PowerShell, quote values that contain a comma,
e.g. `--requests="cpu=500m,memory=128Mi"`.

## The race

At **10:20 WIB** the facilitator starts the clock. Complete the missions **in order** and press
**Check on my cluster** in Launchpad after each one. Launchpad checks your real cluster and records
your time. Ranking: most missions passed, then the fastest time.

| Mission | Goal — what Launchpad checks |
|---|---|
| **M0 Launch** | Your own 3-node cluster in JKT1, connected to Launchpad (3 nodes Ready) |
| **M1 Deploy & Expose** | NusaMart deployed; `http://<EXTERNAL-IP>/health` returns 200 |
| **M2 Right-size** | Requests = limits (QoS Guaranteed), 2+ replicas ready |
| **M3 Scale** | An HPA on `ecommerce-rust` (min ≥ 2, max ≥ 4) that has scaled out under load |
| **M4 Stay Available** | A PodDisruptionBudget, pods on 2+ nodes, no node left cordoned |
| **Final Flash Sale Ready** | HPA min ≥ 3, pods on 3 nodes, and a live burst of 120 requests: 0 errors, p95 < 1.5 s |

M0 — create and connect your cluster. **Path A (recommended): Civo dashboard + Launchpad Shell**

1. <https://dashboard.civo.com/kubernetes/new>: region **Jakarta (JKT1)**, **3 nodes**, size **g4s.kube.medium**,
   CNI **Cilium** → Create cluster. Wait until it is **Active** (1–2 min).
2. On the cluster page: **Cluster information → Download kubeconfig**.
3. Launchpad → **⌨️ Terminal** → **Open my shell**, then drop the kubeconfig file into the panel. Your shell
   connects to the cluster and installs the read-only **Mission Agent** by itself (the prompt turns green).
4. In the shell: `kubectl get nodes` (3 nodes Ready), then press **Check on my cluster** on M0.

**Path B: your own terminal**

```bash
civo apikey save my-civo <YOUR-API-KEY>
civo apikey use my-civo
civo region use JKT1
civo kubernetes create civo-k8s-lab --size g4s.kube.medium --nodes 3 --cni-plugin cilium \
  --create-firewall --wait --save --merge --switch
kubectl get nodes
```

Then press **Connect my cluster** in Launchpad and run the one command it shows you:

```bash
kubectl apply -f https://<launchpad>/join/agt-<your-personal-link>.yaml
kubectl get pods -n civo-launchpad      # mission-agent 1/1 Running
```

The **Mission Agent** is a tiny pod with **read-only** access (nodes, pods, services, deployments, HPAs, PDBs —
never Secrets or ConfigMaps). It reports to Launchpad over HTTPS; no API key leaves your laptop.
Never upload or share your API key.

M1 onwards — start here:

```bash
kubectl apply -k k8s/overlays/before
kubectl get svc ecommerce-rust-svc -n nusamart -w
```

Load test (runs inside your cluster):

```bash
kubectl delete job k6-flash-sale -n loadtest --ignore-not-found
kubectl apply -k k6
kubectl logs -f job/k6-flash-sale -n loadtest
```

The step-by-step commands for every mission are in Civo Launchpad (type `hint` in its terminal).

After the workshop, keep learning in the **Civo Kubernetes Academy**: <https://s.id/civo-academy>

## Rules

- Do not change the container image or the `RECO_WORK` value — the checks verify both.
- Your API key and kubeconfig are yours alone. Do not share them. The Launchpad Shell and the kubeconfig in it
  are deleted when you press End session, after 2 idle hours, or at 23:59 WIB.
- Account blocked on the day? Ask a facilitator for a backup seat.
- Do not delete the `civo-launchpad` namespace during the race — Launchpad checks your missions through it.
- Your cluster is billed per hour from your credit. When you are done:
  `civo kubernetes delete civo-k8s-lab --region JKT1 -y` (this removes the Mission Agent too), then check `civo volume ls` and `civo loadbalancer ls`.

## What is in this repo

```
k8s/base/                 Namespace, Deployment, Service (LoadBalancer)
k8s/components/undersized the "before" sizing: 1 replica, CPU limit 100m
k8s/overlays/before       your starting point
k6/                       in-cluster flash-sale load test
```
