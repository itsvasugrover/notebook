---
title: Remotes and Package Management
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/remotes/
---

# Remotes and Package Management

**Remotes** in Conan are servers that store packages - think of them as "app stores" for C++ libraries. Just like you have different app stores (Apple App Store, Google Play Store, etc.), Conan has different package repositories where you can download and upload libraries.

## What are Remotes?

A remote is essentially a **Conan package server** that:

- Stores packages (binaries and recipes)
- Handles package uploads from developers
- Serves packages to consumers
- Manages package metadata and search

## Default Remotes

### ConanCenter (The Main Repository)

```bash
# ConanCenter is pre-configured and contains thousands of packages
conan remote list

# Output shows something like:
# conancenter: https://center.conan.io [Verify SSL: True, Enabled: True]
```

### Searching ConanCenter

```bash
# Search for packages
conan search fmt
conan search boost
conan search "opengl*" --remote=conancenter

# Get package information
conan show fmt/10.0.0
```

## Custom Remotes

### Why Create Custom Remotes?

1. **Private Libraries** - Your company's internal libraries
2. **Third-party Integration** - Libraries from partners/customers
3. **Offline Development** - Mirror of packages for air-gapped environments
4. **Performance** - Local mirrors for faster downloads
5. **Control** - Curated package repositories with security reviews

### Setting Up Your Own Conan Server

#### Option 1: Artifactory (Recommended for Enterprises)

**JFrog Artifactory** is the most popular Conan repository server.

```bash
# Add Artifactory remote
conan remote add mycompany https://mycompany.jfrog.io/artifactory/api/conan/conan-local

# Authenticate
export CONAN_LOGIN_USERNAME=myuser
export CONAN_PASSWORD=mypassword
conan remote auth mycompany
```

**Features of Artifactory:**

- User management and permissions
- Package promotion between environments
- Replication and backup
- Analytics and monitoring
- Integration with CI/CD

#### Option 2: Conan Server (Simple Setup)

**Conan Server** is a lightweight option for small teams:

```bash
# Install conan server
pip install conan-server

# Start the server
conan_server

# This starts a server on http://localhost:9300
```

#### Option 3: Cloud Solutions

**GitHub Packages**

```bash
# Add GitHub Packages as remote
conan remote add github-packages https://npm.pkg.github.com/@your-org

# Authenticate with GitHub token
export CONAN_LOGIN_USERNAME=your-github-username
export CONAN_PASSWORD=your-github-token
conan remote auth github-packages
```

**GitLab Package Registry**

```bash
# Add GitLab Packages
conan remote add gitlab-packages https://gitlab.com/api/v4/packages/conan

# Authenticate
export CONAN_LOGIN_USERNAME=your-gitlab-username
export CONAN_PASSWORD=your-gitlab-token
conan remote auth gitlab-packages
```

**AWS CodeArtifact**

```bash
# Add AWS CodeArtifact
conan remote add codeartifact https://your-domain-123456789.d.codeartifact.us-west-2.amazonaws.com/conan/your-repo/

# Authenticate with AWS
aws codeartifact login --tool conan --repository your-repo --domain your-domain --domain-owner 123456789
```

### Creating a Local Conan Server

#### Quick Setup for Development

```bash
# 1. Create a working directory
mkdir conan-server && cd conan-server

# 2. Initialize Conan server
conan server

# 3. This creates a server configuration in the current directory
# 4. Access at http://localhost:9300
```

#### Configuration File

Create `server.conf`:

```ini
[server]
jwt_secret=your-secret-key
jwt_expire_minutes=60

write_permissions = */*@*/*
read_permissions = */*@*/*

[users]
admin=password123
developer1=devpassword1
```

#### Starting the Server

```bash
# Start with custom configuration
conan server --server_file server.conf --host 0.0.0.0 --port 8080

# Server is now available at http://your-server:8080
```

### Adding and Managing Remotes

#### Add a Remote

```bash
# Basic remote
conan remote add myremote https://my-conan-server.com

# Remote with specific name
conan remote add mycompany-remote https://artifactory.mycompany.com/conan

# Add remote with disabled SSL verification (not recommended for production)
conan remote add insecure-remote http://insecure-server.com --insecure
```

#### Update Remote

```bash
# Change remote URL
conan remote update myremote https://new-url.com

# Disable/enable remote
conan remote disable myremote
conan remote enable myremote

# Remove remote
conan remote remove myremote
```

#### List and Show Remotes

```bash
# List all remotes
conan remote list

# Show remote details
conan remote show myremote

# Check remote connectivity
conan ping myremote
```

### Authentication and Security

#### Username/Password Authentication

```bash
# Set authentication for remote
conan remote auth myremote --username=jdoe --password=secret123

# Or use interactive prompt
conan remote auth myremote
```

#### Token-Based Authentication

```bash
# For JFrog Artifactory
conan remote auth myremote --username=jdoe --password=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# For GitHub/GitLab
conan remote auth myremote --username=jdoe --password=ghp_xxxxxxxxxxxxxxxxxxxx
```

#### Environment-Based Authentication

```bash
# Set environment variables
export CONAN_LOGIN_USERNAME=jdoe
export CONAN_PASSWORD=your_token_here

# Conan will use these for authentication
conan install . --remote=myremote
```

#### Certificate-Based Authentication

```bash
# For self-signed certificates
conan remote add my-https-remote https://self-signed-server.com --verify-ssl=false

# For specific CA certificates
export REQUESTS_CA_BUNDLE=/path/to/ca-bundle.crt
export SSL_CERT_FILE=/path/to/ca-bundle.crt
```

## Publishing Packages to Custom Remotes

### Upload Packages

```bash
# Upload a single package
conan upload mylib/1.0.0@user/channel --remote=myremote

# Upload with all binaries
conan upload mylib/1.0.0@user/channel --remote=myremote --all

# Upload specific packages only
conan upload mylib/1.0.0@user/channel --remote=myremote --package-folder=mybinary

# Upload with confirmation
conan upload mylib/1.0.0@user/channel --remote=myremote --confirm
```

### Upload Patterns

```bash
# Upload all packages matching pattern
conan upload "*@user/channel" --remote=myremote

# Upload with specific versioning
conan upload "mylib/1.*" --remote=myremote

# Upload only if package doesn't exist
conan upload mylib/1.0.0@user/channel --remote=myremote --skip-uploaded
```

### Upload with Retry and Error Handling

```bash
# Retry on failures
conan upload mylib/1.0.0@user/channel --remote=myremote --retry=3 --retry-wait=10

# Upload with query conditions
conan upload mylib/1.0.0@user/channel --remote=myremote --query "arch=x86_64 AND build_type=Release"
```

## Working with Package Repositories

### Repository Structure

```
my-company-remote/
├── libraries/
│   ├── mylib/1.0.0/
│   │   ├── user1/channel/
│   │   └── user2/stable/
│   └── otherlib/2.1.0/
│       └── user1/testing/
├── internal/
│   └── proprietary/1.0.0/
└── third-party/
    └── vendor-lib/3.0.0/
```

### Package Promotion Workflow

```bash
# 1. Develop and test in testing channel
conan create . mylib/1.0.0@user/testing

# 2. Upload to testing remote
conan upload mylib/1.0.0@user/testing --remote=testing-remote

# 3. Promote to staging after QA approval
conan copy mylib/1.0.0@user/testing mylib/1.0.0@user/staging --remote=testing-remote --destination=staging-remote

# 4. Promote to production
conan copy mylib/1.0.0@user/staging mylib/1.0.0@user/stable --remote=staging-remote --destination=prod-remote
```

## Mirroring and Replication

### Local Mirror Setup

```bash
# Add ConanCenter as a mirror
conan remote add conan-center-mirror https://center.conan.io

# Mirror specific packages
conan download fmt/10.0.0 --remote=conan-center-mirror
conan upload fmt/10.0.0 --remote=local-mirror
```

### Artifactory Remote Replication

```yaml
# Artifactory replication configuration
replications:
  - url: "https://local-artifactory.company.com/artifactory/api/conan/conan-local"
    cronExp: "0 0 2 * * ?" # Daily at 2 AM
    repoKey: conan-local
    proxy: true
```

## Troubleshooting Remote Issues

### Common Problems

#### Authentication Failures

```bash
# Check authentication
conan remote auth myremote --username=test --password=test

# Clear authentication cache
conan remote logout myremote
```

#### Package Not Found

```bash
# Search for packages
conan search --remote=myremote mylib

# Check if package exists
conan search --remote=myremote "*mylib*"

# Download recipe only
conan download mylib/1.0.0@user/channel --remote=myremote --recipe-only
```

#### SSL/TLS Issues

```bash
# Disable SSL verification (development only)
conan remote add my-remote http://insecure-server.com --insecure

# Update CA certificates
sudo apt update && sudo apt install ca-certificates

# Check SSL certificate
openssl s_client -connect myremote.com:443
```

### Debug Remote Operations

```bash
# Verbose output
conan install . --remote=myremote --verbose

# Check package info before downloading
conan info mylib/1.0.0@user/channel --remote=myremote

# Download and show progress
conan download mylib/1.0.0@user/channel --remote=myremote --progress
```

## Remote Best Practices

### Security

1. **Use HTTPS** - Never use unencrypted HTTP in production
2. **Authentication tokens** - Use API tokens instead of passwords
3. **Certificate validation** - Don't disable SSL verification in production
4. **User permissions** - Configure proper access controls

### Performance

1. **Local mirrors** - Set up mirrors close to your developers
2. **Concurrent downloads** - Enable parallel package downloads
3. **Package retention** - Clean up old versions to save space
4. **Bandwidth throttling** - Configure limits for large teams

### Organization

1. **Naming conventions** - Use clear, descriptive remote names
2. **Environment separation** - Separate dev/staging/production remotes
3. **Package promotion** - Implement proper promotion workflows
4. **Monitoring** - Track usage and package metrics

### Key Points: Remotes and Package Management

- **Remotes are package servers** - Like app stores for C++ libraries
- **Multiple options** - Artifactory, Conan Server, cloud providers
- **Authentication required** - Username/password, tokens, certificates
- **Upload/download workflow** - Share packages across teams
- **Security best practices** - HTTPS, proper authentication, permissions
- **Performance optimization** - Local mirrors, concurrent operations
- **Enterprise features** - Replication, analytics, package promotion
