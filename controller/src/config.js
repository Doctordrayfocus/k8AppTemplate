// import kubernetes client
const k8s = require("@kubernetes/client-node")
const yaml = require("js-yaml")
const fs = require("fs")
const path = require("path")
require('dotenv').config()


// get kubernetes configuration
const kc = new k8s.KubeConfig();
kc.loadFromDefault();


// generate configurations from app template parameters

const replaceAll = function (mainString, find, replace) {
  return mainString.replace(
    new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"),
    replace
  );
};



const generateConfig = async (templateConfig) => {
  const allConfigs = [];

  return new Promise(async (resolveMain) => {
    const readFolderFiles = () => {
      return new Promise((resolve) => {
        fs.readdir(path.join(__dirname, "../configs"), (err, files) => {
          resolve(files);
        });
      });
    };

    const files = await readFolderFiles();

    const readAndMakeTemplate = (file) => {
      return new Promise((resolve) => {
        fs.readFile(
          path.join(__dirname, `../configs/${file}`),
          { encoding: "utf-8" },
          function (err, data) {
            if (!err) {
              let stringValue = `${data}`;
              for (const key in templateConfig) {
                if (templateConfig.hasOwnProperty(key)) {
                  const value = templateConfig[key];
                  stringValue = replaceAll(stringValue, "${" + key + "}", value);
                }
              }

              const configType = file.split(".")[0].toLocaleLowerCase();

              resolve({
                type: configType,
                content: stringValue
              })

            } else {
              console.log(err);
              resolve(null)
            }


          }
        );
      });
    };

    console.log(files)

    const configForAllFiles = async () => {
      const allPromises = []
      files.forEach(async (file) => {
        allPromises.push(
          readAndMakeTemplate(file).then((fileConfig) => {
            if (fileConfig) {
              allConfigs.push(fileConfig)
            }
          })
          .catch((err) => {
            console.log(err); 
          })
        )
      })
      await Promise.all(allPromises)
      resolveMain(allConfigs)
    }

    await configForAllFiles();
  })
};


// Apply configurations using K8s core api

const applyConfiguration = async (yamlString) => {
  const client = k8s.KubernetesObjectApi.makeApiClient(kc);
  const specs = yaml.loadAll(yamlString);
  const validSpecs = specs.filter((s) => s && s.kind && s.metadata);
  const created = [];
  for (const spec of validSpecs) {
    spec.metadata = spec.metadata || {};
    spec.metadata.annotations = spec.metadata.annotations || {};
    delete spec.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'];
    spec.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'] = JSON.stringify(spec);
    try {
      // try to get the resource, if it does not exist an error will be thrown and we will end up in the catch
      // block.
      await client.read(spec);
      // we got the resource, so it exists, so patch it
      //
      // Note that this could fail if the spec refers to a custom resource. For custom resources you may need
      // to specify a different patch merge strategy in the content-type header.
      //
      // See: https://github.com/kubernetes/kubernetes/issues/97423
      const response = await client.patch(spec);
      created.push(response.body);
    } catch (e) {
      console.log(e)
      // // we did not get the resource, so it does not exist, so create it
      // const response = await client.create(spec);
      // created.push(response.body);
    }
  }
  return created;
}

// create or update app configurations using the template configurations

const enviromentData = process.env;

const applyAppTemplate = async (templateConfig) => {

  const templateAndEnvironmentData = { ...templateConfig, ...enviromentData };

  console.log(templateAndEnvironmentData)

  const processedConfigs = await generateConfig(templateAndEnvironmentData);

  console.log(processedConfigs)

  if (processedConfigs.length > 0) {
    // apply namespace first

    const namespaceConfig = processedConfigs.filter((configData) => {
      return configData.type == 'namespace'
    })

    await applyConfiguration(namespaceConfig[0].content)

    // apply other configurations

    // const otherConfig = processedConfigs.filter((configData) => {
    //   return configData.type != 'namespace'
    // })

    // otherConfig.forEach(async (configData) => {
    //   await applyConfiguration(configData.content)
    // })
  }

}

module.exports = {
  applyAppTemplate
}