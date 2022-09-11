// import kubernetes client
import * as k8s from '@kubernetes/client-node';
import { applyAppTemplate } from './config'
require('dotenv').config()

// get kubernetes configuration
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// Get app template list using k8s custom api

const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);

const listAppTemplates = k8sCustomApi.listClusterCustomObject(
	process.env.RESOURCE_GROUP,
	process.env.API_VERSION,
	process.env.RESOURCE_NAME
)

// Create and run an informer to listen for custom app template resources

const initiateInformer = () => {
	const informer = k8s.makeInformer(kc, `/apis/${process.env.RESOURCE_GROUP}/${process.env.API_VERSION}/namespaces/*/${process.env.RESOURCE_NAME}`, listAppTemplates);

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


