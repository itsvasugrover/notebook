---
title: Installing Jenkins
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/jenkins/installing-jenkins/
---
# Installing Jenkins

Jenkins can be installed on various platforms. Below is a basic installation guide for Ubuntu/Debian.

## Prerequisites

- Java 8 or 11 installed on the system.

## Installation Steps

1. Update the package index: `sudo apt update`
2. Install Java if not present: `sudo apt install openjdk-11-jdk`
3. Add the Jenkins repository key: `wget -q -O - https://pkg.jenkins.io/debian/jenkins.io.key | sudo apt-key add -`
4. Add the Jenkins repository: `sudo sh -c 'echo deb http://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'`
5. Update packages and install Jenkins: `sudo apt update && sudo apt install jenkins`
6. Start the Jenkins service: `sudo systemctl start jenkins`
7. Enable Jenkins to start on boot: `sudo systemctl enable jenkins`

## Accessing Jenkins

After installation, access Jenkins at `http://localhost:8080` and follow the setup wizard.
