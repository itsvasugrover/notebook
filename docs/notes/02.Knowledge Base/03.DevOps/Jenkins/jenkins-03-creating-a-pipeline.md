---
title: Creating a Pipeline in Jenkins
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/jenkins/creating-a-pipeline/
---
# Creating a Pipeline in Jenkins

Jenkins pipelines automate the build, test, and deployment process. They can be defined using Groovy-based DSL.

## Declarative Pipeline Example

```groovy
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                echo 'Building the application...'
            }
        }
        stage('Test') {
            steps {
                echo 'Running tests...'
            }
        }
        stage('Deploy') {
            steps {
                echo 'Deploying to production...'
            }
        }
    }
}
```

## Steps to Create a Pipeline

1. Log in to Jenkins and click "New Item".
2. Enter a name and select "Pipeline" as the type.
3. In the configuration, scroll to "Pipeline" section.
4. Choose "Pipeline script" and paste your Groovy code.
5. Save and run the pipeline.
