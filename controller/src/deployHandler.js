// import kubernetes client
import * as k8s from '@kubernetes/client-node';

// get kubernetes configuration
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// generate namespace from app template parameters
const generateNamespace = ({ serviceName, environment }) => {
	const yamlNamespace = `apiVersion: v1
kind: Namespace
metadata:
  name: ${environment}-${serviceName}
`
	return yamlNamespace
}

// set default docker registry (it won't change most of the time)
const dockerRegistry = "drayfocus"

// generate deployment from app template parameters
const generateDeployment = ({ imageName, imageVersion, serviceName, environment, deploymentReplicas }) => {
	const yamlDeployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${serviceName}-deployment
  namespace: ${environment}-${serviceName}
  labels:
    app: ${serviceName}
spec:
  replicas: ${deploymentReplicas}
  selector:
    matchLabels:
      app: ${serviceName}
  template:
    metadata:
      labels:
        app: ${serviceName}
    spec:
      containers:
      - name: ${service}-deployment
        image: ${dockerRegistry}/${imageName}_main_app:v${imageVersion}
        ports:
        - containerPort: 3000
`
	return yamlDeployment
}

// generate service from app template parameters
const generateService = ({ serviceName, environment }) => {
	const yamlService = `apiVersion: v1
kind: Service
metadata:
  name: ${serviceName}-service
  namespace: ${environment}-${serviceName}
spec:
  selector:
    app: ${serviceName}
  type: LoadBalancer
  ports:
  - protocol: TCP
    port: 5000
    targetPort: 3000
    nodePort: 31110
`
	return yamlService
}

// Apply configurations using K8s core api

const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

const applyConfiguration = ({ type, yamlString, namespace }) => {
	const yamlConfigContent = k8s.loadYaml(yamlString);

	const requestInitiator = () => {
		switch (type) {
			case 'namespace':
				return k8sCoreApi.createNamespace(yamlConfigContent)
			case 'service':
				return k8sCoreApi.createNamespacedService(namespace, yamlConfigContent)
			case 'deployment':
				return k8sCoreApi.createNamespacedPod(namespace, yamlConfigContent)
			default:
				break;
		}
	}

	requestInitiator().then(
		(response) => {
			console.log('Resource created');
		},
		(err) => {
			console.log('Error!: ' + err);
		}
	);
}

// create or update app configurations using the template configurations

const applyAppTemplate = (templateConfig) => {
	// apply namespace first
	applyConfiguration({
		type: 'namespace',
		yamlString: generateNamespace(templateConfig)
	})

	// apply other configurations

	const appNamespace = `${templateConfig.environment}-${templateConfig.serviceName}`

	applyConfiguration({
		type: 'service',
		yamlString: generateService(templateConfig),
		namespace: appNamespace
	})

	applyConfiguration({
		type: 'deployment',
		yamlString: generateDeployment(templateConfig),
		namespace: appNamespace
	})
}

// Get app template list using k8s custom api

const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);

const listAppTemplates = k8sCustomApi.listClusterCustomObject(
	"myapp.domain.com",
	"v1",
	"apptemplates"
)

// Create and run an informer to listen for custom app template resources

const initiateInformer = () => {
	const informer = k8s.makeInformer(kc, '/apis/myapp.domain.com/v1/namespaces/*/apptemplates', listAppTemplates);

	informer.on('add', (obj) => {
		console.log(`Added: ${obj.metadata.name}`);
		applyAppTemplate(obj.spec)
	});
	informer.on('update', (obj) => {
		console.log(`Updated: ${obj.metadata.name}`);
		applyAppTemplate(obj.spec)
	});
	informer.on('delete', (obj) => {
		console.log(`Deleted: ${obj.metadata.name}`);
	});
	informer.on('error', (err) => {
		console.error(err);
		// Restart informer after 5sec
		setTimeout(() => {
			informer.start();
		}, 5000);
	});

	informer.start();
}

export default {
	initiateInformer
}


