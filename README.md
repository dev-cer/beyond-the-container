# Beyond the Container — Civo Workshop · 26 Nov 2026

**Running Highly Available & Scalable Applications with Kubernetes**
Hands-on mission race on your own Civo Kubernetes cluster, Jakarta region (JKT1).

You build everything on **your own Civo account**: first the cluster, then you take **NusaMart**,
a small e-commerce shop, from "it runs" to "it survives a 12.12 flash sale" — as fast as you can.

## Before you start

1. **Your own Civo account** (required to register): <https://dashboard.civo.com/signup> — verify email
   and phone and add a credit/debit card (not prepaid/virtual). New accounts get USD 250 credit.
2. **An API key** from Profile → Security → API keys. It stays on your laptop.
3. **Tools**: `civo` CLI, `kubectl`, `git`.
4. **This repo**:

```bash
git clone https://github.com/dev-cer/beyond-the-container
cd beyond-the-container
```

5. **Register in Hackspace** with your name, email and Civo account.

## The race

At **10:20 WIB** the facilitator starts the clock. Complete the missions **in order** and press
**Check on my cluster** in Hackspace after each one. Hackspace checks your real cluster and records
your time. Ranking: most missions passed, then the fastest time.

| Mission | Goal — what Hackspace checks |
|---|---|
| **M0 Launch** | Your own 3-node cluster in JKT1, connected to Hackspace (3 nodes Ready) |
| **M1 Deploy & Expose** | NusaMart deployed; `http://<EXTERNAL-IP>/health` returns 200 |
| **M2 Right-size** | Requests = limits (QoS Guaranteed), 2+ replicas ready |
| **M3 Scale** | An HPA on `ecommerce-rust` (min ≥ 2, max ≥ 4) that has scaled out under load |
| **M4 Stay Available** | A PodDisruptionBudget, pods on 2+ nodes, no node left cordoned |
| **Final Flash Sale Ready** | HPA min ≥ 3, pods on 3 nodes, and a live burst of 120 requests: 0 errors, p95 < 1.5 s |

M0 — create and connect your cluster:

```bash
civo apikey save my-civo <YOUR-API-KEY>
civo apikey use my-civo
civo region use JKT1
civo kubernetes create civo-k8s-lab --size g4s.kube.medium --nodes 3 --cni-plugin cilium \
  --create-firewall --wait --save --merge --switch
civo kubernetes config civo-k8s-lab --region JKT1 > kubeconfig-civo-k8s-lab.yaml
kubectl get nodes
```

Upload `kubeconfig-civo-k8s-lab.yaml` with **Connect my cluster** in Hackspace, then press **Check on my
cluster** on M0. Hackspace only reads your cluster for mission checks and deletes the kubeconfig at
23:59 WIB. Never upload or share your API key.

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

The step-by-step commands for every mission are in Hackspace (type `hint` in its terminal).

## Rules

- Do not change the container image or the `RECO_WORK` value — the checks verify both.
- Your API key and kubeconfig are yours alone. Do not share them.
- Account blocked on the day? Ask a facilitator for a backup seat.
- Your cluster is billed per hour from your credit. When you are done:
  `civo kubernetes delete civo-k8s-lab --region JKT1 -y`, then check `civo volume ls` and `civo loadbalancer ls`.

## What is in this repo

```
k8s/base/                 Namespace, Deployment, Service (LoadBalancer)
k8s/components/undersized the "before" sizing: 1 replica, CPU limit 100m
k8s/overlays/before       your starting point
k6/                       in-cluster flash-sale load test
```
