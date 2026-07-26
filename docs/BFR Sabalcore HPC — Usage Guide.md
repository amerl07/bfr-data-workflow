
**Berkeley Formula Racing · Aerodynamics ·** **Dohyun Yang**  
 **Last updated:** June 2026

---

## **Overview**

The BFR Sabalcore relay app is the team's interface for submitting STAR-CCM+ CFD jobs to the Sabalcore HPC cluster. It handles job packaging, PBS script generation, file transfer to the cluster, real-time status monitoring, and result download. This is all completed through a browser UI served from a dedicated Oracle Cloud relay VM.

**You do not need SSH keys, a VPN, or any local software beyond a web browser.**

---

## **Architecture (for reference)**

Your browser  
    │  HTTPS (self-signed TLS, one-time click-through)  
    ▼  
Oracle Cloud VM  \[159.54.164.154:443\]  
    │  SSH (asyncssh, dual persistent connections)  
    ▼  
Sabalcore HPC  \[login.sabalcore.com\]  
    │  PBS/Torque → dque → partition nodes  
    ▼  
STAR-CCM+ 2506  (PoD license, 8 nodes × 16 ppn \= 128 cores)

The relay VM maintains two persistent SSH connections to Sabalcore: one for live monitoring (qstat, mybalance, cluster state) and one for file I/O (uploads, downloads). There are no per-request handshakes. Status updates stream to the browser via Server-Sent Events (SSE).

---

## **Accessing the App**

1. Navigate to: **`https://159.54.164.154`**  
2. On first visit, your browser will warn about the self-signed certificate. Click **Advanced → Proceed** (Chrome). This is a one-time step per browser.  
3. Enter the team passphrase on the login screen: **BerkeleyAero1**

---

## **Submitting a Job**

### **Prerequisites**

Before submitting, your `.sim` file must be **ready to run**. Mesh built (but not run), physics initialized, stopping criteria set. The cluster runs headless. There is no interactive STAR-CCM+ session. 

Also be sure to check that you cleared any generated meshes. This cuts down file size drastically, allowing for faster file uploads. Ideally, your upload should be **less than 150 megabytes**.

### **Job Naming Convention**

Job names follow the pattern:

\<Initials\>\_\<Description\>\_\<YYYYMMDD\>

Examples:

* `DY_B27_baseline_20260601`  
* `MT_RWsweep_v2_20260610`

The name must be alphanumeric with underscores only, no spaces. It is used as the run directory name on Sabalcore (`/e/08/brklyrc01/bfr/<job_name>/`) and as the PBS job name.

### **Submission Steps**

1. Enter a job name following the convention above.  
2. Select a cluster. **Green with 128 cores is most CH-efficient for full car sims**, or any sim with mesh size \~40 million cells.   
3. Upload your `.sim` file using the file selector.  
4. Click **Submit to queue**.

The app will:

* Validate the job name  
* Upload the `.sim` file to the cluster via SFTP  
* Generate and upload the PBS script and STAR-CCM+ export macro  
* Call `qsub` to queue the job

A confirmation will appear with the PBS job ID (e.g., `1498003.jman`).

### **What runs on the cluster**

The PBS script submits to the `dque` queue on the selected partition, requesting the selected number of nodes. The solver excludes the master node from MPI ranks and runs STAR-CCM+ with:

starccm+ \-batch export\_scenes.java \<job\_name\>.sim \-power \-podkey \<key\> \-mpi openmpi \-machinefile machinefile \-np \<NP\>

After the solve, the macro exports all scenes to PNG and dumps force/moment report values to `force_reports.txt`. These are zipped into `post_<job_name>.zip`.

---

## **Monitoring Jobs**

The **Jobs** tab updates in real time via SSE. No manual refresh needed.

### **Job states**

| State | Meaning |
| ----- | ----- |
| **queued** | Waiting in dque; another job is running |
| **running** | Active on cluster nodes |
| **complete** | PBS job finished; post-processing may still be zipping |
| **staged** | Job is offloaded from quick access storage; still accessible through file transfer |
|  |  |
|  |  |

The job panel shows current core-hour balance and the cluster availability panel displays partition node availability.

---

## **Downloading Results**

Once a run shows **complete** state, two download buttons activate in the Jobs table:

* **post.zip** — The full post-processing package: scene PNGs \+ `force_reports.txt`. This is what you want for aero review.  
* **.sim** — The completed simulation file with solution data. Large (\~5–10 GB for full-car); only download if you need to continue the run locally or inspect it in STAR-CCM+.  
  * **Download currently takes an extremely long time for large files. I am working on a fix for this through Global File Transfer. Ask Dohyun if you want to download in the meantime.** 

Downloads stream directly from Sabalcore through the relay VM. Do not close the browser tab mid-download.

> **Note:** If the post.zip button is greyed out after the job shows as complete, the zip step may have failed silently. You can grab the file directly from Sabalcore’s native CLI terminal using the SFTP file transfer tool. 

---

## **Deleting Runs**

The Jobs tab includes a **Delete** button per run. This removes the run directory from Sabalcore (`rm -rf`). You cannot delete a run while its PBS job is active. This action is irreversible — download anything you need first.

---

## **Core-Hour Budget**

The team has a Sabalcore HPC sponsorship of **60,000 core-hours**. A typical full-car STAR-CCM+ run at 600+ iterations, 40M cells, 128 cores costs approximately **90 core-hours** (\~40 min wall time).

**Be deliberate about submissions. Parametric sweeps should use Design Manager locally where possible and only push final candidates to Sabalcore.**

Usage can be monitored and core hours will be tracked. Use Sabalcore for heavy simulation work, but be mindful of the number of core hours you are using\!

---

## **Known Limitations & Quirks**

* **Upload size.** Large `.sim` files (\>1 GB) will take time to upload through the relay. The Oracle VM RAM ceiling is \~956 MB with no swap; uploads are not yet streamed, so avoid uploading files much larger than 1 GB without coordinating with Dohyun first.  
* **Self-signed cert.** The browser warning on first visit is expected. The connection is encrypted; the cert is just not CA-signed.  
* **Relay service restarts.** If the app is unreachable, the `bfr-relay` systemd service on the Oracle VM may need a restart. Contact Dohyun.  
* **Post.zip occasionally breaks.** If it does, give it some time and reload. If it's still broken, contact Dohyun. 

---

## **File Paths on Sabalcore**

For reference if you need to SSH in directly (via the Oracle VM relay):

| Path | Contents |
| ----- | ----- |
| `/e/08/brklyrc01/bfr/` | BFR run root |
| `/e/08/brklyrc01/bfr/<job_name>/` | Per-run directory |
| `/e/08/brklyrc01/bfr/<job_name>/<job_name>.sim` | Simulation file |
| `/e/08/brklyrc01/bfr/<job_name>/post_<job_name>/` | Exported PNGs \+ force\_reports.txt |
| `/e/08/brklyrc01/bfr/<job_name>/post_<job_name>.zip` | Zipped post output |
| `/e/08/brklyrc01/bfr/<job_name>/<job_name>.o<jobid>` | PBS stdout log |
| `/e/08/brklyrc01/bfr/<job_name>/<job_name>.e<jobid>` | PBS stderr log |

To SSH into Sabalcore manually (requires relay hop):

ssh ubuntu@159.54.164.154   \# relay VM  
ssh brklyrc01@login.sabalcore.com   \# then from relay

---
## **Contact**

**Relay app / HPC issues:** Dohyun Yang

# sdf
