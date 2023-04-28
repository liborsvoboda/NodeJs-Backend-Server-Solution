module.exports = (sequelize, type) => {
  return sequelize.define('appsettings', {
    id: {
      type: type.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    paymentVersion: {
      type: type.STRING(255),
      allowNull: false
    },
    creditVariant: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    price: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    invoicePerriod: {
      type: type.STRING(255),
      allowNull: false
    },
    flags: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    cas: {
      type: type.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    expiry: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    indexes: [
      {
        unique: true,
        name: 'IX_settings',
        fields: ['paymentVersion', 'invoicePerriod']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
